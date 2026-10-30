import type { NextRequest } from "next/server";
import { z } from "zod";
import { CSV_TYPE, fileResponse, routeSession, XLSX_TYPE } from "@/lib/http";
import { toCsv, toXlsx } from "@/lib/import/spreadsheet";
import { ALL_STAFF } from "@/lib/roles";
import type { Database } from "@/lib/database.types";

const HEADERS = ["roll_no", "registration_no", "student_name", "institute_code", "exam_code", "theory_marks", "practical_marks", "total_marks", "percentage", "grade", "grade_point", "result", "status", "version", "published_at"];
type ResultStatus = Database["public"]["Enums"]["result_status"];

/** Export results (RLS-scoped: institutes get only their own). */
export async function GET(request: NextRequest) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const sp = request.nextUrl.searchParams;
  const exam = z.uuid().safeParse(sp.get("exam"));
  const status = sp.get("status");
  const rows: unknown[][] = [];
  for (let from = 0; ; from += 1000) {
    let q = session.supabase
      .from("results")
      .select("theory_marks, practical_marks, total_marks, percentage, grade, grade_point, is_pass, status, version, published_at, students!inner(roll_no, registration_no, name_en), exams(code), institutes(code)")
      .order("exam_id")
      .order("student_id")
      .range(from, from + 999);
    if (exam.success) q = q.eq("exam_id", exam.data);
    if (status && ["draft", "submitted", "published", "unpublished"].includes(status)) q = q.eq("status", status as ResultStatus);
    const { data, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    for (const r of data) {
      rows.push([r.students.roll_no, r.students.registration_no, r.students.name_en, r.institutes?.code, r.exams?.code, r.theory_marks, r.practical_marks, r.total_marks, r.percentage, r.grade, r.grade_point, r.is_pass ? "PASS" : "FAIL", r.status, r.version, r.published_at]);
    }
    if (data.length < 1000) break;
  }
  await session.supabase.rpc("log_event", { p_action: "results.export", p_table: "results", p_record_id: exam.success ? exam.data : "", p_data: { rows: rows.length } });
  const stamp = new Date().toISOString().slice(0, 10);
  if (sp.get("format") === "csv") return fileResponse(toCsv(HEADERS, rows), `results-${stamp}.csv`, CSV_TYPE);
  return fileResponse(await toXlsx([{ name: "Results", headers: HEADERS, rows, textColumns: ["roll_no", "registration_no"] }]), `results-${stamp}.xlsx`, XLSX_TYPE);
}
