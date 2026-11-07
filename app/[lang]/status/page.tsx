import { StatusChecker } from "@/components/StatusChecker";
import { getDict, isLang } from "@/lib/i18n";
import { PLATFORM_PUBLIC_KEY } from "@/lib/site";

export default async function Status({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return null;
  const t = getDict(lang);
  return (
    <article className="form-page">
      <h1>{t.status.title}</h1>
      <p className="lead">{t.status.lead}</p>
      <StatusChecker t={t.status} statuses={t.statuses} publicKey={PLATFORM_PUBLIC_KEY} />
    </article>
  );
}
