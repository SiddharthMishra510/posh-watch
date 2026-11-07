"use client";

import Link from "next/link";
import { useState } from "react";
import { cleanImage, getProofOfWork, postJson } from "@/lib/client-api";
import { deriveFromCode, newReceiptCode, sealJson } from "@/lib/crypto-core.js";
import type { Dict } from "@/lib/i18n/types";
import { type ReportPayload, today } from "@/lib/report-types";

type T = Dict["report"];
type Phase = "edit" | "working" | "sending" | "done";

const MAX_FILES = 2;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ReportForm(props: {
  t: T;
  lang: string;
  districts: { id: string; label: string }[];
  publicKey: string;
  statusHref: string;
  statusLabel: string;
}) {
  const { t, lang, districts, publicKey } = props;
  const [f, setF] = useState({
    name: "",
    tradeName: "",
    address: "",
    district: "",
    sector: "",
    employees: "",
    relation: "",
    details: "",
    filing: "platform" as "platform" | "named",
    namedName: "",
    namedContact: "",
    declaration: false,
  });
  const [missing, setMissing] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("edit");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const toggleMissing = (key: string) =>
    setMissing((m) => (m.includes(key) ? m.filter((x) => x !== key) : [...m, key]));

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length > MAX_FILES || list.some((x) => x.size > MAX_FILE_BYTES || !x.type.startsWith("image/"))) {
      setError(t.errFiles);
      e.target.value = "";
      setFiles([]);
      return;
    }
    setError("");
    setFiles(list);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const required = [f.name, f.address, f.district, f.employees, f.relation].every((v) => v.trim());
    const namedOk = f.filing === "platform" || (f.namedName.trim() && f.namedContact.trim());
    if (!required || !missing.length || !f.declaration || !namedOk) {
      setError(t.errRequired);
      return;
    }
    if (!publicKey) {
      setError("This site is not configured yet (missing public key).");
      return;
    }

    try {
      setPhase("working");
      const attachments: ReportPayload["attachments"] = [];
      for (const file of files) {
        try {
          attachments.push({ name: `photo-${attachments.length + 1}.jpg`, type: "image/jpeg", data: await cleanImage(file) });
        } catch {
          setPhase("edit");
          setError(t.errFiles);
          return;
        }
      }

      const newCode = await newReceiptCode();
      const keys = await deriveFromCode(newCode);
      const payload: ReportPayload = {
        v: 1,
        submittedOn: today(),
        lang,
        reporterPublicKey: keys.publicKey,
        establishment: {
          name: f.name.trim(),
          tradeName: f.tradeName.trim(),
          address: f.address.trim(),
          district: f.district,
          sector: f.sector,
          employees: f.employees,
        },
        missing,
        relation: f.relation,
        details: f.details.trim().slice(0, 4000),
        filing: f.filing,
        named: f.filing === "named" ? { name: f.namedName.trim(), contact: f.namedContact.trim() } : null,
        declaration: true,
        attachments,
      };
      const report = await sealJson(payload, publicKey);
      const pow = await getProofOfWork();

      setPhase("sending");
      const res = await postJson("/api/report", { lookup: keys.lookup, report, pow });
      if (!res.ok) throw new Error(String(res.status));
      setCode(keys.code);
      setPhase("done");
      window.scrollTo({ top: 0 });
    } catch {
      setPhase("edit");
      setError(t.errNetwork);
    }
  }

  if (phase === "done") {
    return (
      <div className="success" role="status">
        <h2>{t.successTitle}</h2>
        <p>{t.successCode}</p>
        <p className="code" translate="no">{code}</p>
        <button
          type="button"
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              /* clipboard blocked: the code is on screen */
            }
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
        <p className="warn">{t.successWarn}</p>
        <p>
          {t.successNext} <Link href={props.statusHref}>{props.statusLabel}</Link>
        </p>
      </div>
    );
  }

  const busy = phase !== "edit";

  return (
    <form onSubmit={submit} noValidate>
      <p className="notice">{t.safety}</p>

      <fieldset disabled={busy}>
        <legend>{t.sectionWorkplace}</legend>
        <label>
          {t.establishment}
          <input value={f.name} onChange={set("name")} required maxLength={200} autoComplete="off" />
        </label>
        <label>
          {t.tradeName}
          <input value={f.tradeName} onChange={set("tradeName")} maxLength={200} autoComplete="off" />
        </label>
        <label>
          {t.address}
          <textarea value={f.address} onChange={set("address")} required maxLength={500} rows={3} autoComplete="off" />
        </label>
        <div className="row">
          <label>
            {t.district}
            <select value={f.district} onChange={set("district")} required>
              <option value="">{t.choose}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          <label>
            {t.sector}
            <select value={f.sector} onChange={set("sector")}>
              <option value="">{t.choose}</option>
              {Object.entries(t.sectors).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="radio-group" role="radiogroup" aria-label={t.employees}>
          <span className="group-label">{t.employees}</span>
          {Object.entries(t.ranges).map(([k, v]) => (
            <label key={k} className="inline">
              <input type="radio" name="employees" value={k} checked={f.employees === k} onChange={set("employees")} /> {v}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={busy}>
        <legend>{t.sectionMissing}</legend>
        <div className="radio-group">
          <span className="group-label">{t.missing}</span>
          {Object.entries(t.missingOptions).map(([k, v]) => (
            <label key={k} className="inline">
              <input type="checkbox" checked={missing.includes(k)} onChange={() => toggleMissing(k)} /> {v}
            </label>
          ))}
        </div>
        <div className="radio-group" role="radiogroup" aria-label={t.relation}>
          <span className="group-label">{t.relation}</span>
          {Object.entries(t.relations).map(([k, v]) => (
            <label key={k} className="inline">
              <input type="radio" name="relation" value={k} checked={f.relation === k} onChange={set("relation")} /> {v}
            </label>
          ))}
        </div>
        <label>
          {t.details}
          <span className="hint">{t.detailsHint}</span>
          <textarea value={f.details} onChange={set("details")} maxLength={4000} rows={4} autoComplete="off" />
        </label>
        <label>
          {t.attachments}
          <span className="hint">{t.attachmentsHint}</span>
          <input type="file" accept="image/*" multiple onChange={onFiles} />
        </label>
      </fieldset>

      <fieldset disabled={busy}>
        <legend>{t.sectionFiling}</legend>
        <div className="radio-group" role="radiogroup" aria-label={t.filing}>
          <span className="group-label">{t.filing}</span>
          <label className="inline">
            <input type="radio" name="filing" value="platform" checked={f.filing === "platform"} onChange={set("filing")} /> {t.filingPlatform}
          </label>
          <label className="inline">
            <input type="radio" name="filing" value="named" checked={f.filing === "named"} onChange={set("filing")} /> {t.filingNamed}
          </label>
        </div>
        {f.filing === "named" && (
          <div className="named">
            <p className="warn">{t.namedWarning}</p>
            <label>
              {t.namedName}
              <input value={f.namedName} onChange={set("namedName")} maxLength={120} autoComplete="off" />
            </label>
            <label>
              {t.namedContact}
              <input value={f.namedContact} onChange={set("namedContact")} maxLength={120} autoComplete="off" />
            </label>
          </div>
        )}
        <label className="inline declaration">
          <input type="checkbox" checked={f.declaration} onChange={set("declaration")} /> {t.declaration}
        </label>
        <p className="hint">{t.falseInfo}</p>
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}
      {busy && <p className="progress" role="status">{phase === "working" ? t.working : t.sending}</p>}

      <button type="submit" className="button primary" disabled={busy}>{t.submit}</button>
    </form>
  );
}
