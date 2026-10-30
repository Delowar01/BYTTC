import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getLocale, pick } from "@/lib/i18n";

export const getSettings = cache(async () => {
  const { data } = await createPublicClient().from("site_settings").select("*").eq("id", 1).single();
  return data!;
});

export const getMenu = cache(async (location: "header" | "footer") => {
  const { data } = await createPublicClient().from("menu_items").select("label_en, label_bn, href").eq("location", location).order("sort_order");
  return data ?? [];
});

export const getPage = cache(async (slug: string) => {
  const { data } = await createPublicClient().from("pages").select("*").eq("slug", slug).maybeSingle();
  return data;
});

/** SEO metadata for a CMS page, falling back to the site defaults. */
export async function pageMetadata(slug: string): Promise<Metadata> {
  const [locale, settings, page] = await Promise.all([getLocale(), getSettings(), getPage(slug)]);
  const siteTitle = pick(locale, settings.seo_title_en, settings.seo_title_bn) || pick(locale, settings.org_name_en, settings.org_name_bn);
  const title = slug === "home" ? siteTitle : `${pick(locale, page?.seo_title_en, page?.seo_title_bn) || pick(locale, page?.title_en, page?.title_bn)} | ${pick(locale, settings.org_name_en, settings.org_name_bn)}`;
  const description = pick(locale, page?.seo_description_en, page?.seo_description_bn) || pick(locale, settings.seo_description_en, settings.seo_description_bn);
  const image = page?.og_image_url || settings.og_image_url;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, images: image ? [image] : undefined, locale: locale === "bn" ? "bn_BD" : "en_US", type: "website" },
  };
}
