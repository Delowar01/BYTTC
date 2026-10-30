import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, getSettings, pageMetadata } from "@/lib/public-data";
import { ResultSearch } from "./result-search";

export const generateMetadata = () => pageMetadata("results");

export default async function ResultsPage() {
  const locale = await getLocale();
  const [page, settings] = await Promise.all([getPage("results"), getSettings()]);
  const t = getDictionary(locale);
  return (
    <>
      <div className="no-print">
        <PageHero title={pick(locale, page?.title_en, page?.title_bn)} intro={pick(locale, page?.body_en, page?.body_bn)} />
      </div>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ResultSearch t={t} locale={locale} issuer={pick(locale, settings.org_name_en, settings.org_name_bn)} disclaimer={t.resultDisclaimer} />
      </div>
    </>
  );
}
