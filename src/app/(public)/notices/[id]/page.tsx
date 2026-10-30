import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/public/markdown";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { createPublicClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";

async function getNotice(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await createPublicClient().from("notices").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/notices/[id]">): Promise<Metadata> {
  const [locale, notice] = await Promise.all([getLocale(), getNotice((await params).id)]);
  return notice ? { title: pick(locale, notice.title_en, notice.title_bn) } : {};
}

export default async function NoticePage({ params }: PageProps<"/notices/[id]">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const notice = await getNotice((await params).id);
  if (!notice) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/notices" className="text-sm text-primary hover:underline">
        ← {t.backToNotices}
      </Link>
      <time className="mt-6 block text-sm text-muted-foreground">{formatDate(notice.published_at, locale)}</time>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{pick(locale, notice.title_en, notice.title_bn)}</h1>
      <div className="mt-6">
        <Markdown>{pick(locale, notice.body_en, notice.body_bn)}</Markdown>
      </div>
      {notice.attachment_url && (
        <Button asChild variant="outline" className="mt-6">
          <a href={notice.attachment_url} target="_blank" rel="noopener noreferrer">
            <Download /> {t.attachment}
          </a>
        </Button>
      )}
    </article>
  );
}
