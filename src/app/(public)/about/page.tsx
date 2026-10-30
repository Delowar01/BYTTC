import { notFound } from "next/navigation";
import { Markdown } from "@/components/public/markdown";
import { PageHero } from "@/components/public/page-hero";
import { getLocale, pick } from "@/lib/i18n";
import { getPage, pageMetadata } from "@/lib/public-data";

export const generateMetadata = () => pageMetadata("about");

export default async function AboutPage() {
  const [locale, page] = await Promise.all([getLocale(), getPage("about")]);
  if (!page) notFound();
  return (
    <>
      <PageHero title={pick(locale, page.title_en, page.title_bn)} />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Markdown>{pick(locale, page.body_en, page.body_bn)}</Markdown>
      </div>
    </>
  );
}
