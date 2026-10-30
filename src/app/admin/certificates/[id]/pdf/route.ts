import { routeSession } from "@/lib/http";
import { CERTIFICATE_COLUMNS, renderCertificates, type CertificateRow } from "@/lib/documents/certificates";
import { pdfResponse } from "@/lib/pdf-response";
import { ALL_STAFF } from "@/lib/roles";

/** Certificate PDF for staff (RLS: institutes only see their own). */
export async function GET(_request: Request, ctx: RouteContext<"/admin/certificates/[id]/pdf">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const { data: cert } = await session.supabase.from("certificates").select(CERTIFICATE_COLUMNS).eq("id", id).maybeSingle();
  if (!cert) return Response.json({ error: "Not found" }, { status: 404 });
  const bytes = await renderCertificates(session.supabase, [cert as CertificateRow]);
  await session.supabase.rpc("log_event", { p_action: "certificate.download", p_table: "certificates", p_record_id: id });
  return pdfResponse(bytes, `certificate-${cert.certificate_no}.pdf`);
}
