import { CoverageChecker } from "@/components/CoverageChecker";
import { getDict, isLang } from "@/lib/i18n";

export default async function Covered({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return null;
  const t = getDict(lang).covered;
  return (
    <article className="prose">
      <h1>{t.title}</h1>
      <p className="lead">{t.lead}</p>
      <CoverageChecker t={t} lang={lang} />
    </article>
  );
}
