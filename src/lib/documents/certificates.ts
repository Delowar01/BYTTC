import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { renderCertificatePdf, type CertificateSnapshot } from "@/lib/certificate-pdf";
import { renderIssued, verifyUrl } from "./issued";

export const CERTIFICATE_COLUMNS = "id, certificate_no, status, issued_at, snapshot, layout, background_path, background_type";

export type CertificateRow = {
  certificate_no: string;
  status: string;
  issued_at: string;
  snapshot: unknown;
  layout: unknown;
  background_path: string | null;
  background_type: string | null;
};

/**
 * Certificates issued under a document template render from their template
 * snapshot; older ones keep the original built-in design. Several
 * certificates are merged into one PDF (templated ones first).
 */
export async function renderCertificates(client: SupabaseClient, certs: CertificateRow[]) {
  const templated = certs.filter((c) => c.layout);
  const legacy = certs.filter((c) => !c.layout);
  const parts: Uint8Array[] = [];
  if (templated.length) {
    parts.push(
      await renderIssued(
        client,
        client,
        templated.map((c) => ({ number: c.certificate_no, layout: c.layout, background_path: c.background_path, background_type: c.background_type, data: c.snapshot, overlay: c.status === "valid" ? undefined : "REVOKED" })),
        templated.length === 1 ? `Certificate ${templated[0].certificate_no}` : "Certificates",
      ),
    );
  }
  if (legacy.length) {
    const { data: s } = await client.from("site_settings").select("org_name_en, org_name_bn, logo_url, disclaimer_en, cert_title_en, cert_signatory_left, cert_signatory_right").eq("id", 1).single();
    if (!s) throw new Error("Site settings missing");
    for (const c of legacy) {
      parts.push(
        await renderCertificatePdf({
          certificateNo: c.certificate_no,
          status: c.status as "valid" | "revoked",
          issuedAt: c.issued_at,
          snapshot: c.snapshot as CertificateSnapshot,
          org: { name: s.org_name_en, nameBn: s.org_name_bn, title: s.cert_title_en, logoUrl: s.logo_url, disclaimer: s.disclaimer_en, signLeft: s.cert_signatory_left, signRight: s.cert_signatory_right },
          verifyUrl: verifyUrl(c.certificate_no),
        }),
      );
    }
  }
  if (parts.length === 1) return parts[0];
  const merged = await PDFDocument.create();
  merged.setTitle("Certificates");
  for (const bytes of parts) {
    const src = await PDFDocument.load(bytes);
    for (const page of await merged.copyPages(src, src.getPageIndices())) merged.addPage(page);
  }
  return merged.save();
}
