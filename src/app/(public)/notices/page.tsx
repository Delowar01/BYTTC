import Link from "next/link";
import { Paperclip, Pin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, pageMetadata } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";

export const generateMetadata = () => pageMetadata("notices");

export default async function NoticesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [page, { data: notices }] = await Promise.all([
    getPage("notices"),
    createPublicClient().from("notices").select("id, title_en, title_bn, published_at, is_pinned, attachment_url").order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(100),
  ]);
  return (
    <>
      <PageHero title={pick(locale, page?.title_en, page?.title_bn)} intro={pick(locale, page?.body_en, page?.body_bn)} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card className="py-2">
          <CardContent className="divide-y px-4">
            {!notices?.length && <p className="py-6 text-muted-foreground">{t.noNotices}</p>}
            {notices?.map((n) => (
              <Link key={n.id} href={`/notices/${n.id}`} className="flex items-start gap-4 py-4 hover:text-primary">
                <time className="w-24 shrink-0 text-sm text-muted-foreground">{formatDate(n.published_at, locale)}</time>
                <span className="flex-1 font-medium">
                  {pick(locale, n.title_en, n.title_bn)}
                  {n.is_pinned && (
                    <Badge variant="warning" className="ml-2">
                      <Pin /> {t.pinned}
                    </Badge>
                  )}
                </span>
                {n.attachment_url && <Paperclip className="size-4 text-muted-foreground" />}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
