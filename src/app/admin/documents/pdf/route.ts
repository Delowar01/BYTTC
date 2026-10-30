import { z } from "zod";
import { routeSession } from "@/lib/http";
import { renderIssued } from "@/lib/documents/issued";
import { pdfResponse } from "@/lib/pdf-response";
import { ALL_STAFF } from "@/lib/roles";

const PART_SIZE = 50; // keeps each response well under hosting body limits
const optionalId = z.union([z.literal(""), z.uuid()]);

/** Bulk PDF of valid admit/registration cards, in parts of 50 (RLS applies). */
export async function GET(request: Request) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const sp = new URL(request.url).searchParams;
  const type = z.enum(["admit_card", "registration_card"]).safeParse(sp.get("type"));
  const filters = z.object({ exam: optionalId, institute: optionalId, course: optionalId, session: optionalId }).safeParse({
    exam: sp.get("exam") ?? "",
    institute: sp.get("institute") ?? "",
    course: sp.get("course") ?? "",
    session: sp.get("session") ?? "",
  });
  const part = Math.max(1, Number(sp.get("part")) || 1);
  if (!type.success || !filters.success) return Response.json({ error: "Invalid filters" }, { status: 400 });
  const f = filters.data;
  if (type.data === "admit_card" && !f.exam) return Response.json({ error: "Select an exam" }, { status: 400 });

  const join = f.course || f.session ? ", students!inner(course_id, session_id)" : "";
  let query = session.supabase
    .from("documents")
    .select(`id, document_no, layout, background_path, background_type, data${join}`)
    .eq("doc_type", type.data)
    .eq("status", "valid")
    .order("document_no")
    .range((part - 1) * PART_SIZE, part * PART_SIZE - 1);
  if (f.exam) query = query.eq("exam_id", f.exam);
  if (f.institute) query = query.eq("institute_id", f.institute);
  if (f.course) query = query.eq("students.course_id", f.course);
  if (f.session) query = query.eq("students.session_id", f.session);
  const { data: docs, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!docs?.length) return Response.json({ error: "No valid documents for these filters" }, { status: 404 });

  const rows = docs as unknown as { document_no: string; layout: unknown; background_path: string | null; background_type: string | null; data: unknown }[];
  const label = type.data === "admit_card" ? "Admit cards" : "Registration cards";
  const bytes = await renderIssued(session.supabase, session.supabase, rows.map((d) => ({ ...d, number: d.document_no })), label);
  await session.supabase.rpc("log_event", { p_action: "document.bulk_download", p_table: "documents", p_record_id: f.exam || f.institute || f.course || type.data, p_data: { type: type.data, part, count: rows.length } });
  return pdfResponse(bytes, `${type.data.replace("_", "-")}s-part-${part}.pdf`, false);
}
