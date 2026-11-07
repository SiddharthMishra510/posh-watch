import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";
import { getDict, isLang, LANGS } from "@/lib/i18n";
import { SITE_NAME } from "@/lib/site";
import "../globals.css";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Report, anonymously, a Maharashtra workplace with no POSH Internal Committee.",
  referrer: "no-referrer",
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14532d" };

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await headers(); // per-request rendering, so the CSP nonce reaches Next's scripts
  const t = getDict(lang);
  const nav = [
    ["", t.nav.home],
    ["/covered", t.nav.covered],
    ["/report", t.nav.report],
    ["/status", t.nav.status],
    ["/safety", t.nav.safety],
  ] as const;

  return (
    <html lang={lang}>
      <body>
        <a className="skip" href="#main">{t.skip}</a>
        <header className="site-header">
          <div className="wrap header-row">
            <Link href={`/${lang}`} className="brand">{SITE_NAME}</Link>
            <LangSwitch current={lang} langs={LANGS.map((l) => ({ code: l, name: getDict(l).langName }))} />
          </div>
          <nav className="wrap nav" aria-label="Main">
            {nav.map(([path, label]) => (
              <Link key={path} href={`/${lang}${path}`}>{label}</Link>
            ))}
          </nav>
        </header>
        <main id="main" className="wrap main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p>{t.footer.pilot} {t.footer.scope}</p>
            {t.footer.reviewNote && <p className="muted">{t.footer.reviewNote}</p>}
            <p className="footer-links">
              <Link href={`/${lang}/privacy`}>{t.nav.privacy}</Link>
              <Link href={`/${lang}/officials`}>{t.nav.officials}</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
