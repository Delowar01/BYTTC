import { env } from "@/lib/env";
import { routeSession } from "@/lib/http";
import { loadLogo } from "@/lib/documents/assets";
import { orgData, SETTINGS_COLUMNS } from "@/lib/documents/data";
import { SAMPLE_MARKS, sampleData } from "@/lib/documents/fields";
import { renderDocumentPdf } from "@/lib/documents/render";
import { parseLayout } from "@/lib/documents/schema";
import { templateLoader } from "@/lib/documents/templates";
import type { DocType } from "@/lib/documents/types";
import { samplePhoto } from "@/lib/documents/uploads";
import { pdfResponse } from "@/lib/pdf-response";
import { PUBLISHERS } from "@/lib/roles";

/** Template preview with fictional sample data, stamped SAMPLE. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/templates/[id]/preview">) {
  const session = await routeSession(PUBLISHERS);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const [{ data: t }, { data: settings }] = await Promise.all([
    session.supabase.from("document_templates").select("doc_type, name, version, layout, background_path, background_type").eq("id", id).maybeSingle(),
    session.supabase.from("site_settings").select(SETTINGS_COLUMNS).eq("id", 1).single(),
  ]);
  if (!t || !settings) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = parseLayout(t.layout);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
  const type = t.doc_type as DocType;
  const template = await templateLoader(session.supabase)({ ...t, layout: parsed.layout });
  const s = settings as unknown as Parameters<typeof orgData>[0] & { logo_url: string | null };
  const bytes = await renderDocumentPdf(
    [
      {
        ...template,
        data: { ...sampleData(type, env.siteUrl), ...orgData(s) },
        marks: type === "marksheet" || type === "certificate" ? SAMPLE_MARKS : undefined,
        photo: await samplePhoto(),
        overlay: "SAMPLE",
      },
    ],
    { title: `${t.name} v${t.version} (sample)`, author: s.org_name_en, logo: await loadLogo(s.logo_url) },
  );
  return pdfResponse(bytes, `template-${type}-v${t.version}-sample.pdf`);
}
