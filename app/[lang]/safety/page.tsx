import { getDict, isLang } from "@/lib/i18n";

export default async function Safety({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return null;
  const t = getDict(lang).safety;
  return (
    <article className="prose">
      <h1>{t.title}</h1>
      <p className="lead">{t.lead}</p>
      <ul className="tips">
        {t.items.map((i) => (
          <li key={i.t}>
            <strong>{i.t}</strong>
            <span>{i.d}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
