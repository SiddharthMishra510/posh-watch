"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dict } from "@/lib/i18n/types";

type Size = "lt10" | "ge10" | "unsure" | null;
type Ic = "yes" | "no" | "unsure" | null;

export function CoverageChecker({ t, lang }: { t: Dict["covered"]; lang: string }) {
  const [size, setSize] = useState<Size>(null);
  const [ic, setIc] = useState<Ic>(null);
  const reset = () => { setSize(null); setIc(null); };

  return (
    <div className="checker">
      <fieldset>
        <legend>{t.q1}</legend>
        <p className="hint">{t.employeeNote}</p>
        <div className="choices">
          {([["lt10", t.lt10], ["ge10", t.ge10], ["unsure", t.unsure10]] as const).map(([v, label]) => (
            <button key={v} type="button" className={size === v ? "choice on" : "choice"} aria-pressed={size === v} onClick={() => { setSize(v); setIc(null); }}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {size === "lt10" && <p className="result">{t.lt10Result}</p>}
      {size === "unsure" && <p className="result">{t.unsure10Result}</p>}

      {(size === "ge10" || size === "unsure") && (
        <fieldset>
          <legend>{t.q2}</legend>
          <div className="choices">
            {([["yes", t.icYes], ["no", t.icNo], ["unsure", t.icUnsure]] as const).map(([v, label]) => (
              <button key={v} type="button" className={ic === v ? "choice on" : "choice"} aria-pressed={ic === v} onClick={() => setIc(v)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {ic && (
        <div className="result" role="status">
          <p>{ic === "yes" ? t.icYesResult : t.icNoResult}</p>
          <Link className="button primary" href={`/${lang}/report`}>{t.goReport}</Link>
        </div>
      )}

      {size && <button type="button" className="link-button" onClick={reset}>{t.startOver}</button>}
    </div>
  );
}
