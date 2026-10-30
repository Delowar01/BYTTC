import { renderCertificatePdf, type CertificateSnapshot } from "@/lib/certificate-pdf";
import { env } from "@/lib/env";
import { routeSession } from "@/lib/http";
import { ALL_STAFF } from "@/lib/roles";

/** Certificate PDF for staff (RLS: institutes only see their own). */
export async function GET(_request: Request, ctx: RouteContext<"/admin/certificates/[id]/pdf">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const [{ data: cert }, { data: settings }] = await Promise.all([
    session.supabase.from("certificates").select("certificate_no, status, issued_at, snapshot").eq("id", id).maybeSingle(),
    session.supabase.from("site_settings").select("org_name_en, org_name_bn, logo_url, disclaimer_en, cert_title_en, cert_signatory_left, cert_signatory_right").eq("id", 1).single(),
  ]);
  if (!cert || !settings) return Response.json({ error: "Not found" }, { status: 404 });
  const verifyUrl = `${env.siteUrl.replace(/\/$/, "")}/verify?no=${encodeURIComponent(cert.certificate_no)}`;
  const bytes = await renderCertificatePdf({
    certificateNo: cert.certificate_no,
    status: cert.status as "valid" | "revoked",
    issuedAt: cert.issued_at,
    snapshot: cert.snapshot as unknown as CertificateSnapshot,
    org: {
      name: settings.org_name_en,
      nameBn: settings.org_name_bn,
      title: settings.cert_title_en,
      logoUrl: settings.logo_url,
      disclaimer: settings.disclaimer_en,
      signLeft: settings.cert_signatory_left,
      signRight: settings.cert_signatory_right,
    },
    verifyUrl,
  });
  await session.supabase.rpc("log_event", { p_action: "certificate.download", p_table: "certificates", p_record_id: id });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificate-${cert.certificate_no}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
