import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/public/markdown";
import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getSettings } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { localizeDigits } from "@/lib/utils";

async function getCourse(code: string) {
  const { data } = await createPublicClient().from("courses").select("*").eq("code", code.toUpperCase()).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/courses/[code]">): Promise<Metadata> {
  const [locale, course, settings] = await Promise.all([getLocale(), getCourse((await params).code), getSettings()]);
  if (!course) return {};
  return { title: { absolute: `${pick(locale, course.title_en, course.title_bn)} | ${pick(locale, settings.org_name_en, settings.org_name_bn)}` }, description: pick(locale, course.summary_en, course.summary_bn) };
}

export default async function CoursePage({ params }: PageProps<"/courses/[code]">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const course = await getCourse((await params).code);
  if (!course) notFound();
  return (
    <>
      <PageHero title={pick(locale, course.title_en, course.title_bn)} intro={pick(locale, course.summary_en, course.summary_bn)} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {course.image_url && (
            <img src={course.image_url} alt="" className="mb-6 max-h-80 w-full rounded-xl object-cover" />
          )}
          <Markdown>{pick(locale, course.description_en, course.description_bn) || pick(locale, course.summary_en, course.summary_bn)}</Markdown>
        </div>
        <Card className="h-fit">
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">{t.code}:</span> <span className="font-mono">{course.code}</span>
            </p>
            {course.duration_months && (
              <p>
                <span className="text-muted-foreground">{t.duration}:</span> {localizeDigits(course.duration_months, locale)} {t.months}
              </p>
            )}
            {course.fee !== null && (
              <p>
                <span className="text-muted-foreground">{t.fee}:</span> {localizeDigits(Number(course.fee).toLocaleString("en"), locale)} {t.taka}
              </p>
            )}
            <Button asChild className="w-full">
              <Link href="/institutes">{t.findInstitute}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
