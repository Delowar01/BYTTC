import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getSettings } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { ApplyForm } from "./apply-form";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, settings] = await Promise.all([getLocale(), getSettings()]);
  return { title: { absolute: `${getDictionary(locale).applyTitle} | ${pick(locale, settings.org_name_en, settings.org_name_bn)}` } };
}

export default async function ApplyPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { data: courses } = await createPublicClient().from("courses").select("code, title_en, title_bn").order("sort_order");
  return (
    <>
      <PageHero title={t.applyTitle} intro={t.applyIntro} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card>
          <CardContent>
            <ApplyForm t={t} courses={(courses ?? []).map((c) => ({ code: c.code, title: pick(locale, c.title_en, c.title_bn) }))} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
