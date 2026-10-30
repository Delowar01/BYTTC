import Link from "next/link";
import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, pageMetadata } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { localizeDigits } from "@/lib/utils";

export const generateMetadata = () => pageMetadata("courses");

export default async function CoursesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [page, { data: courses }] = await Promise.all([
    getPage("courses"),
    createPublicClient().from("courses").select("code, title_en, title_bn, summary_en, summary_bn, duration_months, fee, image_url").order("sort_order").order("code"),
  ]);
  return (
    <>
      <PageHero title={pick(locale, page?.title_en, page?.title_bn) || t.featuredCourses} intro={pick(locale, page?.body_en, page?.body_bn)} />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {!courses?.length && <p className="text-muted-foreground">{t.noCourses}</p>}
        {courses?.map((c) => (
          <Link key={c.code} href={`/courses/${c.code}`}>
            <Card className="h-full gap-0 overflow-hidden pt-0 transition hover:border-primary/50 hover:shadow-md">
              {c.image_url ? (
                <img src={c.image_url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-end bg-gradient-to-br from-primary to-[oklch(0.35_0.07_200)] px-6 pb-3 font-mono text-sm text-white/80">{c.code}</div>
              )}
              <CardHeader className="pt-5">
                <CardTitle>{pick(locale, c.title_en, c.title_bn)}</CardTitle>
                <CardDescription>{pick(locale, c.summary_en, c.summary_bn)}</CardDescription>
              </CardHeader>
              <CardContent className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {c.duration_months && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-4" /> {localizeDigits(c.duration_months, locale)} {t.months}
                  </span>
                )}
                {c.fee !== null && (
                  <span>
                    {t.fee}: {localizeDigits(Number(c.fee).toLocaleString("en"), locale)} {t.taka}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
