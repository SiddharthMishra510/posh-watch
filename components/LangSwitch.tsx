"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LangSwitch({ current, langs }: { current: string; langs: { code: string; name: string }[] }) {
  const path = usePathname() || `/${current}`;
  const rest = path.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return (
    <ul className="langs" aria-label="Language">
      {langs.map((l) => (
        <li key={l.code}>
          {l.code === current ? (
            <span aria-current="true">{l.name}</span>
          ) : (
            <Link href={`/${l.code}${rest}`} lang={l.code} hrefLang={l.code}>{l.name}</Link>
          )}
        </li>
      ))}
    </ul>
  );
}
