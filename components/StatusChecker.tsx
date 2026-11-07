"use client";

import { useState } from "react";
import { getProofOfWork, postJson } from "@/lib/client-api";
import { deriveFromCode, normalizeCode, openJson, sealJson } from "@/lib/crypto-core.js";
import type { Dict } from "@/lib/i18n/types";
import { type MessagePayload, today } from "@/lib/report-types";
import type { CaseStatus } from "@/lib/status";

type Keys = Awaited<ReturnType<typeof deriveFromCode>>;
type Shown = { direction: "to_reporter" | "to_platform"; text: string; on: string };

export function StatusChecker({ t, statuses, publicKey }: { t: Dict["status"]; statuses: Dict["statuses"]; publicKey: string }) {
  const [input, setInput] = useState("");
  const [keys, setKeys] = useState<Keys | null>(null);
  const [state, setState] = useState<{ status: CaseStatus; createdOn: string; messages: Shown[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);

  async function load(k: Keys) {
    const res = await postJson("/api/status", { lookup: k.lookup });
    if (res.status === 404) {
      setError(t.notFound);
      setState(null);
      return;
    }
    if (!res.ok) throw new Error("status");
    const data = (await res.json()) as { status: CaseStatus; createdOn: string; messages: { direction: Shown["direction"]; ciphertext: string; createdOn: string }[] };
    const messages: Shown[] = [];
    for (const m of data.messages) {
      try {
        const p = await openJson<MessagePayload>(m.ciphertext, k.publicKey, k.privateKey);
        messages.push({ direction: m.direction, text: p.text, on: m.createdOn });
      } catch {
        /* a message we cannot open is skipped */
      }
    }
    setState({ status: data.status, createdOn: data.createdOn, messages });
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent(false);
    if (!normalizeCode(input)) {
      setError(t.invalidCode);
      return;
    }
    setBusy(true);
    try {
      const k = await deriveFromCode(input);
      setKeys(k);
      await load(k);
    } catch {
      setError(t.notFound);
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!keys || !reply.trim() || !publicKey) return;
    setBusy(true);
    try {
      const msg: MessagePayload = { text: reply.trim().slice(0, 4000), on: today() };
      const ciphertext = await sealJson(msg, publicKey);
      const copy = await sealJson(msg, keys.publicKey);
      const pow = await getProofOfWork();
      const res = await postJson("/api/reply", { lookup: keys.lookup, ciphertext, copy, pow });
      if (!res.ok) throw new Error("reply");
      setReply("");
      setSent(true);
      await load(keys);
    } catch {
      setError(t.notFound);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={check} className="code-form">
        <label>
          {t.codeLabel}
          <input value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" translate="no" />
        </label>
        <button type="submit" className="button primary" disabled={busy}>{busy ? t.checking : t.check}</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {state && (
        <section className="status-card" aria-live="polite">
          <p className="muted">{t.current}</p>
          <p className="status-label">{statuses[state.status].label}</p>
          <p>{statuses[state.status].desc}</p>
          <p className="muted">{t.submittedOn}: {state.createdOn}</p>

          <h2>{t.messages}</h2>
          {state.messages.length === 0 ? (
            <p className="muted">{t.none}</p>
          ) : (
            <ul className="thread">
              {state.messages.map((m, i) => (
                <li key={i} className={m.direction === "to_reporter" ? "from-us" : "from-you"}>
                  <span className="who">{m.direction === "to_reporter" ? t.fromUs : t.fromYou} · {m.on}</span>
                  <p>{m.text}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={send} className="reply">
            <label>
              {t.reply}
              <span className="hint">{t.replyHint}</span>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={4000} autoComplete="off" />
            </label>
            <button type="submit" className="button" disabled={busy || !reply.trim()}>{t.send}</button>
            {sent && <span className="ok" role="status">{t.sent}</span>}
          </form>
        </section>
      )}
    </div>
  );
}
