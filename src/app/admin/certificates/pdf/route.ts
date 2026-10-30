import { z } from "zod";
import { routeSession } from "@/lib/http";
import { CERTIFICATE_COLUMNS, renderCertificates, type CertificateRow } from "@/lib/documents/certificates";
import { pdfResponse } from "@/lib/pdf-response";
import { ALL_STAFF } from "@/lib/roles";

const PART_SIZE = 50; // keeps each response well under hosting body limits

/** Bulk PDF of an exam's valid certificates, in parts of 50 (RLS applies). */
export async function GET(request: Request) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const sp = new URL(request.url).searchParams;
  const exam = z.uuid().safeParse(sp.get("exam"));
  const part = Math.max(1, Number(sp.get("part")) || 1);
  if (!exam.success) return Response.json({ error: "Select an exam" }, { status: 400 });
  const { data: certs, error } = await session.supabase
    .from("certificates")
    .select(`${CERTIFICATE_COLUMNS}, results!inner(exam_id)`)
    .eq("results.exam_id", exam.data)
    .eq("status", "valid")
    .order("certificate_no")
    .range((part - 1) * PART_SIZE, part * PART_SIZE - 1);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!certs?.length) return Response.json({ error: "No valid certificates for this exam" }, { status: 404 });
  const bytes = await renderCertificates(session.supabase, certs as unknown as CertificateRow[]);
  await session.supabase.rpc("log_event", { p_action: "certificate.bulk_download", p_table: "certificates", p_record_id: exam.data, p_data: { part, count: certs.length } });
  return pdfResponse(bytes, `certificates-part-${part}.pdf`, false);
}
