import { Sections } from "@/components/Sections";
import { getDict, isLang } from "@/lib/i18n";
import { CONTACT_EMAIL } from "@/lib/site";

export default async function Privacy({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return null;
  const t = getDict(lang).privacy;
  return (
    <Sections title={t.title} lead={t.lead} sections={t.sections}>
      {CONTACT_EMAIL && <p className="contact"><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>}
    </Sections>
  );
}
