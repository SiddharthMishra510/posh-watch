"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keysMatch, openJson, sealJson } from "@/lib/crypto-core.js";
import { LETTERS, type LetterKind, type Operator } from "@/lib/letters";
import { type MessagePayload, type ReportPayload, today } from "@/lib/report-types";
import { CASE_STATUSES, type CaseStatus } from "@/lib/status";

// The operator's back office. The admin token and private key live only in this
// tab's memory; closing the tab forgets them. Decryption happens here, never on
// the server.

type Session = { token: string; publicKey: string; privateKey: string };
type Summary = { id: number; ref: string; status: CaseStatus; createdOn: string; filedOn: string | null; updatedOn: string; unread: number };
type RawCase = Summary & { report: string; notes: string | null; messages: { id: number; direction: "to_reporter" | "to_platform"; ciphertext: string; copy: string; createdOn: string }[] };
type Notes = {
  checks: Record<string, { done: boolean; date: string; note: string }>;
  employeesBasis: string;
  sheboxDate: string;
  tracking: string;
  replyStatus: string;
  text: string;
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  received: "Received",
  needs_info: "Needs info from reporter",
  verified: "Verified",
  filed: "Filed with District Officer",
  acknowledged: "Acknowledged",
  inspection_ordered: "Inspection ordered",
  ic_formed: "IC formed",
  closed_not_filed: "Closed, not filed",
  closed: "Closed",
};

const CHECKS = [
  ["exists", "1. The establishment exists (MCA, GST, website)"],
  ["address", "2. Address is in Maharashtra; district is right"],
  ["size", "3. 10+ employees supported by an independent source"],
  ["shebox", "4. No IC listed on SHe-Box (screenshot saved)"],
  ["facts", "5. Facts are specific and observable"],
  ["duplicate", "6. No duplicate open case"],
  ["board", "7. Board's Report checked (companies, optional)"],
] as const;

const MISSING_LABEL: Record<string, string> = {
  no_ic: "No Internal Committee",
  ic_unknown: "IC not made known to staff",
  no_policy: "No written policy",
  no_display: "No notice displayed",
  no_training: "No awareness sessions",
};

const RELATION_LABEL: Record<string, string> = {
  current: "Works there now",
  former: "Used to work there",
  contractor: "Works there via contractor or agency",
  other: "Other",
};

const emptyNotes = (): Notes => ({ checks: {}, employeesBasis: "", sheboxDate: "", tracking: "", replyStatus: "", text: "" });

function daysSince(date: string | null) {
  if (!date) return 0;
  return Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
}

function readOperator(): Operator {
  try {
    const raw = localStorage.getItem("posh-operator");
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable */
  }
  return { name: "", platform: "", address: "", email: "", phone: "" };
}

export function AdminApp({ publicKey }: { publicKey: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<Summary[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!session) throw new Error("no session");
      const res = await fetch(path, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      });
      if (res.status === 401) throw new Error("The admin token was rejected.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    },
    [session],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api("/api/admin/cases");
      setCases(data.cases);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  if (!session) return <Login publicKey={publicKey} onReady={setSession} />;

  return (
    <div className="admin">
      <div className="admin-bar">
        <strong>Cases</strong>
        <button className="button" onClick={refresh}>Refresh</button>
        <OperatorSettings />
        <button className="link-button" onClick={() => { setSession(null); setCases([]); setOpenId(null); }}>Lock</button>
      </div>
      {error && <p className="error">{error}</p>}
      {openId ? (
        <CaseView id={openId} session={session} api={api} onBack={() => { setOpenId(null); refresh(); }} />
      ) : (
        <CaseList cases={cases} onOpen={setOpenId} />
      )}
    </div>
  );
}

function Login({ publicKey, onReady }: { publicKey: string; onReady: (s: Session) => void }) {
  const [token, setToken] = useState("");
  const [keyFile, setKeyFile] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.publicKey || !parsed.privateKey) throw new Error();
      setKeyFile(parsed);
    } catch {
      setError("That is not a key file made by npm run keys.");
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!keyFile || !token) return setError("Both the token and the key file are needed.");
    if (publicKey && keyFile.publicKey !== publicKey) return setError("This key file does not match the public key the site is using.");
    if (!(await keysMatch(keyFile.publicKey, keyFile.privateKey))) return setError("The key file is damaged: its two keys do not match.");
    onReady({ token, ...keyFile });
  }

  return (
    <form className="admin-login" onSubmit={unlock}>
      <h1>Back office</h1>
      <p className="muted">Nothing here is stored. Locking or closing the tab forgets the token and key.</p>
      <label>
        Admin token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
      </label>
      <label>
        Private key file (platform-key.json)
        <input type="file" accept="application/json,.json" onChange={onFile} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button primary" type="submit">Unlock</button>
    </form>
  );
}

function OperatorSettings() {
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState<Operator>(() => (typeof window === "undefined" ? { name: "", platform: "", address: "", email: "", phone: "" } : readOperator()));
  const save = () => {
    try {
      localStorage.setItem("posh-operator", JSON.stringify(op));
    } catch {
      /* storage unavailable: settings last for this tab only */
    }
    setOpen(false);
  };
  if (!open) return <button className="link-button" onClick={() => setOpen(true)}>Letter signature</button>;
  return (
    <div className="operator">
      {(["name", "platform", "address", "email", "phone"] as const).map((k) => (
        <label key={k}>
          {k[0].toUpperCase() + k.slice(1)}
          <input value={op[k]} onChange={(e) => setOp({ ...op, [k]: e.target.value })} />
        </label>
      ))}
      <button className="button" onClick={save}>Save on this browser</button>
    </div>
  );
}

function CaseList({ cases, onOpen }: { cases: Summary[]; onOpen: (id: number) => void }) {
  if (!cases.length) return <p className="muted">No cases yet.</p>;
  return (
    <table className="cases">
      <thead>
        <tr><th>Ref</th><th>Status</th><th>Received</th><th>Filed</th><th>Due</th><th>New replies</th></tr>
      </thead>
      <tbody>
        {cases.map((c) => {
          const age = daysSince(c.filedOn);
          const waiting = c.status === "filed" || c.status === "acknowledged";
          const due = waiting && age >= 45 ? "RTI due" : waiting && age >= 30 ? "Escalate" : "";
          return (
            <tr key={c.id} onClick={() => onOpen(c.id)} className="clickable">
              <td><button className="link-button" onClick={() => onOpen(c.id)}>{c.ref}</button></td>
              <td>{STATUS_LABEL[c.status]}</td>
              <td>{c.createdOn}</td>
              <td>{c.filedOn ?? ""}</td>
              <td className={due ? "due" : ""}>{due}</td>
              <td>{c.unread || ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CaseView({ id, session, api, onBack }: { id: number; session: Session; api: (p: string, i?: RequestInit) => Promise<any>; onBack: () => void }) {
  const [raw, setRaw] = useState<RawCase | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [notes, setNotes] = useState<Notes>(emptyNotes());
  const [thread, setThread] = useState<{ direction: string; text: string; on: string }[]>([]);
  const [status, setStatus] = useState<CaseStatus>("received");
  const [filedOn, setFiledOn] = useState("");
  const [message, setMessage] = useState("");
  const [letter, setLetter] = useState<LetterKind>("english");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { case: c } = (await api(`/api/admin/case?id=${id}`)) as { case: RawCase };
      setRaw(c);
      setStatus(c.status);
      setFiledOn(c.filedOn ?? "");
      if (c.report !== "PURGED") setReport(await openJson<ReportPayload>(c.report, session.publicKey, session.privateKey));
      if (c.notes) setNotes({ ...emptyNotes(), ...(await openJson<Notes>(c.notes, session.publicKey, session.privateKey)) });
      const shown = [];
      for (const m of c.messages) {
        // Reporter messages are sealed to us; ours to her carry a copy sealed to us.
        const blob = m.direction === "to_platform" ? m.ciphertext : m.copy;
        try {
          const p = await openJson<MessagePayload>(blob, session.publicKey, session.privateKey);
          shown.push({ direction: m.direction, text: p.text, on: m.createdOn });
        } catch {
          shown.push({ direction: m.direction, text: "[could not decrypt]", on: m.createdOn });
        }
      }
      setThread(shown);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, id, session]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(extra: Record<string, unknown> = {}) {
    setError("");
    try {
      const body = {
        id,
        status,
        filedOn: filedOn || null,
        notes: await sealJson(notes, session.publicKey),
        ...extra,
      };
      await api("/api/admin/case", { method: "POST", body: JSON.stringify(body) });
      setSaved("Saved");
      setTimeout(() => setSaved(""), 2000);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendMessage() {
    if (!report || !message.trim()) return;
    const msg: MessagePayload = { text: message.trim(), on: today() };
    await save({
      message: {
        ciphertext: await sealJson(msg, report.reporterPublicKey),
        copy: await sealJson(msg, session.publicKey),
      },
    });
    setMessage("");
  }

  async function purge() {
    if (!confirm("Permanently delete this report and all its messages? The case row, status and dates stay. This cannot be undone.")) return;
    try {
      await api(`/api/admin/case?id=${id}`, { method: "DELETE" });
      setReport(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const letterText = useMemo(() => {
    if (!report || !raw) return "";
    const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    return LETTERS[letter].make({
      ref: raw.ref,
      date,
      district: report.establishment.district,
      report,
      operator: readOperator(),
      employeesBasis: notes.employeesBasis,
      sheboxDate: notes.sheboxDate,
      firstLetterDate: filedOn,
      tracking: notes.tracking,
      replyStatus: notes.replyStatus,
    });
  }, [report, raw, letter, notes, filedOn]);

  const setCheck = (k: string, patch: Partial<Notes["checks"][string]>) =>
    setNotes((n) => {
      const base = n.checks[k] ?? { done: false, date: "", note: "" };
      return { ...n, checks: { ...n.checks, [k]: { ...base, ...patch } } };
    });

  if (!raw) return <p className="muted">Loading…</p>;
  const e = report?.establishment;
  const coreChecksDone = ["exists", "address", "size", "shebox", "facts"].every((k) => notes.checks[k]?.done);

  return (
    <div className="case">
      <button className="link-button" onClick={onBack}>← All cases</button>
      <h1>{raw.ref}</h1>
      {error && <p className="error">{error}</p>}

      <section className="admin-panel">
        <div className="row">
          <label>
            Status
            <select value={status} onChange={(ev) => setStatus(ev.target.value as CaseStatus)}>
              {CASE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label>
            Date letter sent (day 0)
            <input type="date" value={filedOn} onChange={(ev) => setFiledOn(ev.target.value)} />
          </label>
        </div>
        {status === "filed" && !coreChecksDone && <p className="warn">Checks 1 to 5 are not all ticked. File only when they pass.</p>}
        <button className="button primary" onClick={() => save()}>Save</button> {saved && <span className="ok">{saved}</span>}
        <p className="muted">The reporter sees the status label in her language when she checks with her code.</p>
      </section>

      {!report ? (
        <p className="muted">Report data has been purged.</p>
      ) : (
        <>
          <section className="admin-panel">
            <h2>Report</h2>
            <dl className="facts">
              <dt>Establishment</dt><dd>{e!.name}{e!.tradeName ? ` (trading as ${e!.tradeName})` : ""}</dd>
              <dt>Address</dt><dd>{e!.address}</dd>
              <dt>District</dt><dd>{e!.district}</dd>
              <dt>Sector</dt><dd>{e!.sector || "not given"}</dd>
              <dt>Employees</dt><dd>{e!.employees}</dd>
              <dt>Missing</dt><dd>{report.missing.map((m) => MISSING_LABEL[m] ?? m).join("; ")}</dd>
              <dt>Reporter is</dt><dd>{RELATION_LABEL[report.relation] ?? report.relation}</dd>
              <dt>Who signs</dt><dd>{report.filing === "named" && report.named ? `Named: ${report.named.name}, ${report.named.contact}` : "Platform (anonymous)"}</dd>
              <dt>Submitted</dt><dd>{report.submittedOn} · form language {report.lang}</dd>
            </dl>
            {report.details && (
              <>
                <h3>Details</h3>
                <p className="pre">{report.details}</p>
                <p className="hint">If this names people or describes a harassment incident, do not forward it.</p>
              </>
            )}
            {report.attachments.length > 0 && (
              <div className="attachments">
                {report.attachments.map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.name} src={`data:image/jpeg;base64,${a.data}`} alt={a.name} />
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <h2>Verification checklist (Annexure A)</h2>
            <table className="checks">
              <tbody>
                {CHECKS.map(([k, label]) => (
                  <tr key={k}>
                    <td><label className="inline"><input type="checkbox" checked={!!notes.checks[k]?.done} onChange={(ev) => setCheck(k, { done: ev.target.checked, date: notes.checks[k]?.date || today() })} /> {label}</label></td>
                    <td><input type="date" value={notes.checks[k]?.date ?? ""} onChange={(ev) => setCheck(k, { date: ev.target.value })} /></td>
                    <td><input placeholder="Source and result" value={notes.checks[k]?.note ?? ""} onChange={(ev) => setCheck(k, { note: ev.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <label>Basis for employee count (goes in the letter)<input value={notes.employeesBasis} onChange={(ev) => setNotes({ ...notes, employeesBasis: ev.target.value })} /></label>
              <label>SHe-Box searched on<input value={notes.sheboxDate} placeholder="e.g. 3 February 2027" onChange={(ev) => setNotes({ ...notes, sheboxDate: ev.target.value })} /></label>
            </div>
            <div className="row">
              <label>Speed post tracking number<input value={notes.tracking} onChange={(ev) => setNotes({ ...notes, tracking: ev.target.value })} /></label>
              <label>Reply so far (for escalation)
                <select value={notes.replyStatus} onChange={(ev) => setNotes({ ...notes, replyStatus: ev.target.value })}>
                  <option value="no acknowledgement">No acknowledgement</option>
                  <option value="an acknowledgement but no information on action taken">Acknowledged, no action reported</option>
                </select>
              </label>
            </div>
            <label>Private notes<textarea rows={3} value={notes.text} onChange={(ev) => setNotes({ ...notes, text: ev.target.value })} /></label>
            <button className="button" onClick={() => save()}>Save checklist and notes (encrypted)</button>
          </section>

          <section className="admin-panel">
            <h2>Letters</h2>
            <p className="muted">Set your name and address under “Letter signature” first. Review every letter before sending.</p>
            <div className="tabs">
              {(Object.keys(LETTERS) as LetterKind[]).map((k) => (
                <button key={k} className={k === letter ? "choice on" : "choice"} onClick={() => setLetter(k)}>{LETTERS[k].label}</button>
              ))}
            </div>
            <pre className="letter print-area">{letterText}</pre>
            <div className="actions">
              <button className="button" onClick={() => navigator.clipboard.writeText(letterText).catch(() => undefined)}>Copy</button>
              <button className="button" onClick={() => window.print()}>Print</button>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Messages with the reporter</h2>
            {thread.length === 0 ? <p className="muted">None yet.</p> : (
              <ul className="thread">
                {thread.map((m, i) => (
                  <li key={i} className={m.direction === "to_reporter" ? "from-us" : "from-you"}>
                    <span className="who">{m.direction === "to_reporter" ? "You" : "Reporter"} · {m.on}</span>
                    <p>{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <label>Message to the reporter (she reads it with her code)<textarea rows={3} value={message} onChange={(ev) => setMessage(ev.target.value)} /></label>
            <button className="button" onClick={sendMessage} disabled={!message.trim()}>Encrypt and send</button>
          </section>
        </>
      )}

      {(raw.status === "closed" || raw.status === "closed_not_filed") && raw.report !== "PURGED" && (
        <section className="admin-panel danger">
          <h2>Retention</h2>
          <p>Delete the report and messages 90 days after closing. Closed {daysSince(raw.updatedOn)} days ago.</p>
          <button className="button" onClick={purge}>Delete report data</button>
        </section>
      )}
    </div>
  );
}
