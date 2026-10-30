import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/public/markdown";
import { PageHero } from "@/components/public/page-hero";
import { getLocale, pick } from "@/lib/i18n";
import { getPage, pageMetadata } from "@/lib/public-data";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  return pageMetadata((await params).slug);
}

export default async function CustomPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const [locale, page] = await Promise.all([getLocale(), getPage(slug)]);
  if (!page || page.is_system) notFound();
  return (
    <>
      <PageHero title={pick(locale, page.title_en, page.title_bn)} />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Markdown>{pick(locale, page.body_en, page.body_bn)}</Markdown>
      </div>
    </>
  );
}
