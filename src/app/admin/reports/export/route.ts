import { fileResponse, routeSession, XLSX_TYPE } from "@/lib/http";
import { toXlsx } from "@/lib/import/spreadsheet";
import { GRADES, loadResultReport, passRate } from "@/lib/reports";
import { ALL_STAFF } from "@/lib/roles";

export async function GET() {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { exams, institutes, students } = await loadResultReport(session.supabase);
  const buffer = await toXlsx([
    {
      name: "Exams",
      headers: ["exam_code", "exam_name", "total", "draft", "submitted", "published", "unpublished", "passed", "pass_rate", ...GRADES],
      rows: exams.map((e) => [e.code, e.name, e.total, e.byStatus.draft ?? 0, e.byStatus.submitted ?? 0, e.published, e.byStatus.unpublished ?? 0, e.passed, passRate(e.passed, e.published), ...GRADES.map((g) => e.grades[g] ?? 0)]),
    },
    { name: "Institutes", headers: ["institute_code", "institute_name", "students", "published_results", "passed", "pass_rate"], rows: institutes.map((i) => [i.code, i.name, i.students, i.published, i.passed, passRate(i.passed, i.published)]) },
    { name: "Enrolment", headers: ["institute_code", "course_code", "session", "status", "students"], rows: students.map((s) => [s.institute_code, s.course_code, s.session_name, s.status, Number(s.n)]) },
  ]);
  await session.supabase.rpc("log_event", { p_action: "reports.export", p_table: "results", p_record_id: "" });
  return fileResponse(buffer, `report-${new Date().toISOString().slice(0, 10)}.xlsx`, XLSX_TYPE);
}
