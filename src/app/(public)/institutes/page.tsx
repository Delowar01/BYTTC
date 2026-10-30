import Link from "next/link";
import { BadgeCheck, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, pageMetadata } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { localizeDigits } from "@/lib/utils";

export const generateMetadata = () => pageMetadata("institutes");

export default async function InstitutesPage({ searchParams }: PageProps<"/institutes">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const q = (await searchParams).q;
  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const [page, { data: institutes }] = await Promise.all([getPage("institutes"), createPublicClient().rpc("public_institutes", { p_search: search })]);
  return (
    <>
      <PageHero title={pick(locale, page?.title_en, page?.title_bn)} intro={pick(locale, page?.body_en, page?.body_bn)} />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <form className="flex w-full max-w-xl gap-2" role="search">
            <Input name="q" defaultValue={search} placeholder={t.institutesSearch} aria-label={t.institutesSearch} />
            <Button type="submit">{t.search}</Button>
          </form>
          <Button variant="outline" asChild>
            <Link href="/apply">{t.applyCta}</Link>
          </Button>
        </div>
        {!institutes?.length && <p className="text-muted-foreground">{t.noInstitutes}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {institutes?.map((i) => (
            <Card key={i.code} className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-start gap-2 leading-snug">
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  {pick(locale, i.name_en, i.name_bn)}
                </CardTitle>
                <p className="font-mono text-xs text-muted-foreground">
                  {t.code}: {i.code}
                </p>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {(i.address || i.district) && (
                  <p className="flex gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0" /> {[i.address, i.district].filter(Boolean).join(", ")}
                  </p>
                )}
                {i.phone && (
                  <p className="flex gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0" /> {i.phone}
                  </p>
                )}
                {i.established_year && (
                  <p>
                    {t.established}: {localizeDigits(i.established_year, locale)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
