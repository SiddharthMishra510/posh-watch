import { ReportForm } from "@/components/ReportForm";
import { DISTRICTS } from "@/lib/districts";
import { getDict, isLang } from "@/lib/i18n";
import { PLATFORM_PUBLIC_KEY } from "@/lib/site";

export default async function Report({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return null;
  const t = getDict(lang);
  const districts = DISTRICTS.map((d) => ({ id: d.id, label: lang === "en" ? d.id : d.dev }));
  return (
    <article className="form-page">
      <h1>{t.report.title}</h1>
      <p className="lead">{t.report.lead}</p>
      <ReportForm t={t.report} lang={lang} districts={districts} publicKey={PLATFORM_PUBLIC_KEY} statusHref={`/${lang}/status`} statusLabel={t.nav.status} />
    </article>
  );
}
