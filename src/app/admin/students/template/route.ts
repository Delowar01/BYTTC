import type { NextRequest } from "next/server";
import { CSV_TYPE, fileResponse, routeSession, XLSX_TYPE } from "@/lib/http";
import { STUDENT_COLUMNS } from "@/lib/import/students";
import { toCsv, toXlsx } from "@/lib/import/spreadsheet";
import { ALL_STAFF } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { supabase } = session;
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const [{ data: institutes }, { data: courses }, { data: sessions }] = await Promise.all([
    supabase.from("institutes").select("code, name_en").eq("status", "approved").order("code"),
    supabase.from("courses").select("code, title_en").order("code"),
    supabase.from("academic_sessions").select("name").eq("is_active", true).order("start_date", { ascending: false }),
  ]);
  const example = [
    institutes?.[0]?.code ?? "INST-CODE",
    courses?.[0]?.code ?? "COURSE",
    sessions?.[0]?.name ?? "Session name",
    "",
    "",
    "Example Student",
    "",
    "Example Father",
    "Example Mother",
    "2004-05-17",
    "female",
    "+880 1800-000000",
    "",
    "Dhaka",
  ];
  if (format === "csv") return fileResponse(toCsv([...STUDENT_COLUMNS], [example]), "students-template.csv", CSV_TYPE);
  const buffer = await toXlsx([
    { name: "Students", headers: [...STUDENT_COLUMNS], rows: [example], textColumns: ["roll_no", "registration_no", "date_of_birth", "phone"] },
    {
      name: "Instructions",
      headers: ["column", "rules"],
      rows: [
        ["institute_code", "Required. See the Institutes sheet (approved institutes only)."],
        ["course_code", "Required. See the Courses sheet."],
        ["session", "Required. Session name exactly as in the Sessions sheet."],
        ["roll_no", "Optional. Leave blank to auto-generate. Must be unique."],
        ["registration_no", "Optional. Leave blank to auto-generate a random number. Must be unique."],
        ["name_en", "Required. 2–120 characters."],
        ["date_of_birth", "Optional. YYYY-MM-DD."],
        ["gender", "Optional. male, female or other."],
      ],
      widths: [18, 90],
    },
    { name: "Institutes", headers: ["institute_code", "name"], rows: (institutes ?? []).map((i) => [i.code, i.name_en]) },
    { name: "Courses", headers: ["course_code", "title"], rows: (courses ?? []).map((c) => [c.code, c.title_en]) },
    { name: "Sessions", headers: ["session"], rows: (sessions ?? []).map((s) => [s.name]), widths: [30] },
  ]);
  return fileResponse(buffer, "students-template.xlsx", XLSX_TYPE);
}
