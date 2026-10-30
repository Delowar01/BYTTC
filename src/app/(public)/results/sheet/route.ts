import { z } from "zod";
import { allowRequest } from "@/lib/client-key";
import { renderMarksheets } from "@/lib/documents/marksheet";
import { pdfResponse } from "@/lib/pdf-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupRows, type LookupMethod } from "../lookup";

const ident = z.string().trim().max(30);

/**
 * Public result-sheet download. POST so the identifiers (incl. an optional
 * passport number) never appear in URLs or access logs. The lookup is re-run
 * and rate limited; only the fields allowed by the privacy settings are used.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const method = String(form.get("method") ?? "") as LookupMethod;
  const first = ident.safeParse(form.get("first"));
  const second = ident.safeParse(form.get("second"));
  const examCode = String(form.get("exam") ?? "");
  if (!first.success || !second.success || !examCode) return new Response("Invalid request", { status: 400 });
  if (!(await allowRequest("result_sheet", 20, "10 minutes"))) return new Response("Too many requests. Please try again later.", { status: 429 });
  const rows = await lookupRows(method, first.data, second.data);
  const row = rows?.find((r) => r.exam_code === examCode);
  if (!row) return new Response("Result not found", { status: 404 });
  const admin = createAdminClient();
  const bytes = await renderMarksheets(admin, [{ ...row, photo_path: row.photo_path }], admin);
  return pdfResponse(bytes, `result-sheet-${row.roll_no}-${row.exam_code}.pdf`, false);
}
