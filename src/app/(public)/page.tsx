import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, FileSearch, Pin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/public/markdown";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, pageMetadata } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { formatDate, localizeDigits } from "@/lib/utils";

export const generateMetadata = () => pageMetadata("home");

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const db = createPublicClient();
  const [page, { data: banners }, { data: stats }, { data: courses }, { data: notices }] = await Promise.all([
    getPage("home"),
    db.from("banners").select("*").order("sort_order"),
    db.rpc("public_stats"),
    db.from("courses").select("code, title_en, title_bn, summary_en, summary_bn, duration_months, image_url").order("sort_order").limit(6),
    db.from("notices").select("id, title_en, title_bn, published_at, is_pinned").order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(5),
  ]);
  const s = stats?.[0];
  const hero = banners?.[0];
  const quick = [
    { href: "/results", icon: FileSearch, label: t.searchResult },
    { href: "/verify", icon: BadgeCheck, label: t.verifyCertificate },
    { href: "/institutes", icon: Building2, label: t.findInstitute },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-[oklch(0.3_0.06_195)] text-white">
        {hero?.image_url && (
          <img src={hero.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,oklch(0.78_0.15_75/0.35),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          {hero ? (
            <div className="max-w-2xl">
              <h1 className="text-3xl leading-tight font-bold sm:text-5xl">{pick(locale, hero.title_en, hero.title_bn)}</h1>
              <p className="mt-4 text-lg text-white/85">{pick(locale, hero.subtitle_en, hero.subtitle_bn)}</p>
              {hero.link_url && (
                <Button asChild size="lg" className="mt-6 bg-brand-accent text-[oklch(0.25_0.05_70)] hover:bg-brand-accent/90">
                  <Link href={hero.link_url}>
                    {pick(locale, hero.link_label_en, hero.link_label_bn) || t.readMore} <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          ) : null}
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur transition hover:bg-white/20">
                <q.icon className="size-6 text-brand-accent" />
                <span className="font-semibold">{q.label}</span>
                <ArrowRight className="ml-auto size-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {s && (
        <section className="border-b bg-background">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-8 md:grid-cols-4">
            {[
              [t.statInstitutes, s.institutes],
              [t.statStudents, s.students],
              [t.statCourses, s.courses],
              [t.statCertified, s.certified],
            ].map(([label, value]) => (
              <div key={String(label)} className="text-center">
                <p className="text-3xl font-bold text-primary">{localizeDigits(Number(value), locale)}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {page && (
            <div className="mb-10">
              <Markdown>{pick(locale, page.body_en, page.body_bn)}</Markdown>
            </div>
          )}
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t.featuredCourses}</h2>
            <Link href="/courses" className="text-sm text-primary hover:underline">
              {t.viewAll}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {courses?.map((c) => (
              <Link key={c.code} href={`/courses/${c.code}`}>
                <Card className="h-full gap-3 transition hover:border-primary/50 hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{pick(locale, c.title_en, c.title_bn)}</CardTitle>
                    <CardDescription>{pick(locale, c.summary_en, c.summary_bn)}</CardDescription>
                  </CardHeader>
                  {c.duration_months && (
                    <CardContent className="text-sm text-muted-foreground">
                      {t.duration}: {localizeDigits(c.duration_months, locale)} {t.months}
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
        <aside>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t.latestNotices}</h2>
            <Link href="/notices" className="text-sm text-primary hover:underline">
              {t.viewAll}
            </Link>
          </div>
          <Card className="py-2">
            <CardContent className="divide-y px-4">
              {!notices?.length && <p className="py-4 text-sm text-muted-foreground">{t.noNotices}</p>}
              {notices?.map((n) => (
                <Link key={n.id} href={`/notices/${n.id}`} className="block py-3 hover:text-primary">
                  <p className="text-xs text-muted-foreground">
                    {n.is_pinned && <Pin className="mr-1 inline size-3 text-brand-accent" />}
                    {formatDate(n.published_at, locale)}
                  </p>
                  <p className="font-medium">{pick(locale, n.title_en, n.title_bn)}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>
    </>
  );
}
