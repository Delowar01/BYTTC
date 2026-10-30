import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { orgData, SETTINGS_COLUMNS } from "@/lib/documents/data";
import { sampleData, TOKENS } from "@/lib/documents/fields";
import { DEFAULT_LAYOUTS } from "@/lib/documents/default-layouts";
import { parseLayout } from "@/lib/documents/schema";
import { TEMPLATE_BUCKET } from "@/lib/documents/templates";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/documents/types";
import { PUBLISHERS } from "@/lib/roles";
import { removeBackground, saveTemplate, uploadAsset, uploadBackground } from "../actions";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Edit template" };

export default async function TemplatePage({ params }: PageProps<"/admin/templates/[id]">) {
  const { supabase } = await requireRole(PUBLISHERS);
  const { id } = await params;
  const [{ data: t }, { data: settings }] = await Promise.all([
    supabase.from("document_templates").select("id, doc_type, name, version, status, layout, background_path, background_type, updated_at").eq("id", id).maybeSingle(),
    supabase.from("site_settings").select(SETTINGS_COLUMNS).eq("id", 1).single(),
  ]);
  if (!t || !settings) notFound();
  const type = t.doc_type as DocType;
  const parsed = parseLayout(t.layout);
  const layout = parsed.ok ? parsed.layout : DEFAULT_LAYOUTS[type];

  // Short-lived signed URLs for the private design and signature images.
  const paths = [...new Set([...(t.background_path && t.background_type !== "pdf" ? [t.background_path] : []), ...layout.fields.flatMap((f) => (f.kind === "image" && f.asset ? [f.asset] : []))])];
  const { data: signed } = paths.length ? await supabase.storage.from(TEMPLATE_BUCKET).createSignedUrls(paths, 1800) : { data: [] };
  const urls = Object.fromEntries((signed ?? []).flatMap((s) => (s.signedUrl && s.path ? [[s.path, s.signedUrl]] : [])));
  const s = settings as unknown as Parameters<typeof orgData>[0] & { logo_url: string | null };

  return (
    <div>
      <PageHeader title={`${t.name} · v${t.version}`} description={`${DOC_TYPE_LABELS[type]} template. Positions are a percentage of the A4 page, so any design resolution works.`}>
        <StatusBadge status={t.status} />
        <Button variant="outline" asChild>
          <Link href="/admin/templates">
            <ArrowLeft /> All templates
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/admin/templates/${t.id}/preview`} target="_blank" rel="noopener">
            <FileDown /> Preview PDF
          </a>
        </Button>
      </PageHeader>
      {!parsed.ok && <p className="mb-3 text-sm text-destructive">The stored layout is invalid ({parsed.error}); the built-in layout is shown instead.</p>}
      <TemplateEditor
        key={t.updated_at}
        docType={type}
        name={t.name}
        status={t.status}
        initialLayout={layout}
        backgroundUrl={t.background_path ? (urls[t.background_path] ?? null) : null}
        backgroundType={t.background_type}
        assetUrls={urls}
        logoUrl={s.logo_url && /^https?:\/\//.test(s.logo_url) ? s.logo_url : null}
        sample={{ ...sampleData(type, env.siteUrl), ...Object.fromEntries(Object.entries(orgData(s)).filter(([, v]) => v)) }}
        tokens={TOKENS[type]}
        save={saveTemplate.bind(null, t.id)}
        uploadBackground={uploadBackground.bind(null, t.id)}
        removeBackground={removeBackground.bind(null, t.id)}
        uploadAsset={uploadAsset.bind(null, t.id)}
      />
    </div>
  );
}
