import Link from "next/link";
import { getDict, isLang } from "@/lib/i18n";
import { Rich } from "@/components/Rich";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return null;
  const t = getDict(lang).home;
  return (
    <>
      <section className="hero">
        <h1>{t.title}</h1>
        <p className="lead"><Rich text={t.lead} /></p>
        <div className="actions">
          <Link className="button primary" href={`/${lang}/report`}>{t.ctaReport}</Link>
          <Link className="button" href={`/${lang}/covered`}>{t.ctaCovered}</Link>
        </div>
      </section>

      <section>
        <h2>{t.howTitle}</h2>
        <ol className="steps">
          {t.steps.map((s) => (
            <li key={s.t}>
              <h3>{s.t}</h3>
              <p><Rich text={s.d} /></p>
            </li>
          ))}
        </ol>
      </section>

      <section className="two-col">
        <div className="panel">
          <h2>{t.notTitle}</h2>
          <ul>{t.notItems.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
        <div className="panel panel-warm">
          <h2>{t.harassTitle}</h2>
          <p>{t.harassLead}</p>
          <ul>{t.harassItems.map((i) => <li key={i}><Rich text={i} /></li>)}</ul>
        </div>
      </section>
    </>
  );
}
