import type { NextRequest } from "next/server";
import { CSV_TYPE, fileResponse, routeSession, XLSX_TYPE } from "@/lib/http";
import { RESULT_COLUMNS } from "@/lib/import/results";
import { toCsv, toXlsx } from "@/lib/import/spreadsheet";
import { ALL_STAFF } from "@/lib/roles";

const RULES: [string, string, string][] = [
  ["roll_no", "Required", "Student roll number exactly as registered."],
  ["registration_no", "Required", "Must match the student's registration number."],
  ["student_name", "Optional", "For your own cross-check; a mismatch is shown as a warning."],
  ["institute_code", "Required", "Code of the student's (approved) institute — see the Institutes sheet."],
  ["course_code", "Required", "Code of the student's course — must match the exam's course."],
  ["exam_code", "Required", "Exam code — see the Exams sheet."],
  ["theory_marks", "Required*", "Number from 0 to the exam's theory full marks, max 2 decimals (*blank allowed only if full marks is 0)."],
  ["practical_marks", "Required*", "Number from 0 to the exam's practical full marks, max 2 decimals."],
  ["viva_marks", "Required if the exam has Viva", "Number from 0 to the exam's Viva full marks. Leave blank when the exam has no Viva (see Exams sheet)."],
  ["remarks", "Optional", "Up to 500 characters."],
];

/** Downloadable result upload template, with live reference lists. */
export async function GET(request: NextRequest) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { supabase } = session;
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const [{ data: exams }, { data: institutes }, { data: sample }] = await Promise.all([
    supabase.from("exams").select("code, name, theory_full_marks, practical_full_marks, viva_full_marks, pass_marks, courses(code)").eq("is_active", true).order("code"),
    supabase.from("institutes").select("code, name_en").eq("status", "approved").order("code"),
    supabase.from("students").select("roll_no, registration_no, name_en, institutes(code), courses(code)").limit(2),
  ]);

  const exampleExam = (code?: string) => exams?.find((e) => e.courses?.code === code)?.code ?? "EXAM-CODE";
  const examples: string[][] = (sample ?? []).map((s) => [
    s.roll_no,
    s.registration_no,
    s.name_en,
    s.institutes?.code ?? "",
    s.courses?.code ?? "",
    exampleExam(s.courses?.code),
    "45",
    "25",
    "",
    "",
  ]);

  if (format === "csv") {
    return fileResponse(toCsv([...RESULT_COLUMNS], examples), "results-template.csv", CSV_TYPE);
  }
  const buffer = await toXlsx([
    { name: "Results", headers: [...RESULT_COLUMNS], rows: examples, textColumns: ["roll_no", "registration_no", "institute_code", "course_code", "exam_code"], widths: [14, 18, 26, 16, 14, 18, 14, 16, 12, 24] },
    { name: "Instructions", headers: ["column", "required", "rules"], rows: [...RULES, ["", "", ""], ["NOTE", "", "Example rows use real roll numbers visible to you; replace them. Imported results are saved as DRAFT and are never published automatically."]], widths: [18, 12, 100] },
    { name: "Exams", headers: ["exam_code", "course_code", "name", "theory_full_marks", "practical_full_marks", "viva_full_marks", "pass_marks"], rows: (exams ?? []).map((e) => [e.code, e.courses?.code, e.name, Number(e.theory_full_marks), Number(e.practical_full_marks), Number(e.viva_full_marks), Number(e.pass_marks)]), widths: [18, 14, 48, 18, 20, 16, 12] },
    { name: "Institutes", headers: ["institute_code", "name"], rows: (institutes ?? []).map((i) => [i.code, i.name_en]), widths: [16, 48] },
  ]);
  return fileResponse(buffer, "results-template.xlsx", XLSX_TYPE);
}
