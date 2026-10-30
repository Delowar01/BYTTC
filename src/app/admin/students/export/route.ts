import type { NextRequest } from "next/server";
import { CSV_TYPE, fileResponse, routeSession, XLSX_TYPE } from "@/lib/http";
import { toCsv, toXlsx } from "@/lib/import/spreadsheet";
import { ALL_STAFF } from "@/lib/roles";
import { readStudentFilters, studentQuery } from "@/lib/students";

const HEADERS = ["roll_no", "registration_no", "name_en", "name_bn", "father_name", "mother_name", "date_of_birth", "gender", "phone", "email", "address", "thana", "district", "passing_year", "institute_code", "course_code", "session", "status"];

/** Export the filtered student list (RLS-scoped). National ID is never exported. */
export async function GET(request: NextRequest) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = readStudentFilters(sp);
  const rows: unknown[][] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await studentQuery(session.supabase, filters).range(from, from + 999);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    for (const s of data) {
      rows.push([s.roll_no, s.registration_no, s.name_en, s.name_bn, s.father_name, s.mother_name, s.date_of_birth, s.gender, s.phone, s.email, s.address, s.thana, s.district, s.passing_year, s.institutes?.code, s.courses?.code, s.academic_sessions?.name, s.status]);
    }
    if (data.length < 1000) break;
  }
  await session.supabase.rpc("log_event", { p_action: "students.export", p_table: "students", p_record_id: "", p_data: { filters, rows: rows.length } });
  const stamp = new Date().toISOString().slice(0, 10);
  if (sp.format === "csv") return fileResponse(toCsv(HEADERS, rows), `students-${stamp}.csv`, CSV_TYPE);
  const buffer = await toXlsx([{ name: "Students", headers: HEADERS, rows, textColumns: ["roll_no", "registration_no", "phone"] }]);
  return fileResponse(buffer, `students-${stamp}.xlsx`, XLSX_TYPE);
}
