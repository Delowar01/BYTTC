import "server-only";
import { courseDuration } from "@/lib/photos";
import type { DocData, MarksRow } from "./types";

export const longDate = (v: string | null | undefined) =>
  v ? new Date(v.length === 10 ? `${v}T00:00:00+06:00` : v).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }) : "";

const num = (v: number | string | null | undefined, digits?: number) =>
  v === null || v === undefined || v === "" ? "" : digits === undefined ? String(Number(v)) : Number(v).toFixed(digits);

export function gpaText(point: number | string | null, max: number | string | null) {
  if (point === null || point === undefined) return "";
  const m = Number(max ?? 5);
  return `${m === 4 ? "CGPA" : "GPA"} ${Number(point).toFixed(2)} on a scale of ${m.toFixed(2)}`;
}

export function gradingText(rules: { min_percent: number; grade: string }[] | null | undefined) {
  return (rules ?? [])
    .filter((r) => Number(r.min_percent) > 0)
    .map((r) => `${r.grade} ${Number(r.min_percent)}%+`)
    .join(" · ");
}

type Settings = {
  org_name_en: string;
  org_name_bn: string | null;
  org_registration_no: string | null;
  tagline_en: string | null;
  disclaimer_en: string | null;
  cert_signatory_left: string;
  cert_signatory_right: string;
};

export const SETTINGS_COLUMNS = "org_name_en, org_name_bn, org_registration_no, tagline_en, disclaimer_en, cert_signatory_left, cert_signatory_right, logo_url, cert_title_en";

export function orgData(s: Settings): DocData {
  return {
    org_name: s.org_name_en,
    org_name_bn: s.org_name_bn ?? "",
    org_registration_no: s.org_registration_no ?? "",
    org_tagline: s.tagline_en ?? "",
    disclaimer: s.disclaimer_en ?? "",
    signatory_left: s.cert_signatory_left,
    signatory_right: s.cert_signatory_right,
    issue_date: longDate(new Date().toISOString()),
  };
}

/** Result fields shared by marksheets and certificates. */
export type ResultFacts = {
  student_name: string;
  student_name_bn?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  roll_no: string;
  registration_no: string;
  institute_name: string;
  institute_code: string;
  institute_registration_no?: string | null;
  course_title: string;
  course_code?: string | null;
  course_duration_months?: number | null;
  course_duration_override?: string | null;
  session_name: string;
  exam_name: string;
  exam_code: string;
  exam_date?: string | null;
  passing_year?: number | null;
  theory_marks: number | null;
  practical_marks: number | null;
  viva_marks: number | null;
  practical_full: number;
  viva_full: number;
  total_marks: number;
  full_marks: number;
  percentage: number;
  grade: string;
  grade_point: number;
  scale_max_point: number | null;
  is_pass: boolean;
  display_published_on?: string | null;
  verify_code: string;
  version: number;
  grading_rules?: { min_percent: number; grade: string }[] | null;
};

export function resultData(r: ResultFacts, siteUrl: string): { data: DocData; marks: MarksRow } {
  const data: DocData = {
    student_name: r.student_name,
    student_name_bn: r.student_name_bn ?? "",
    father_name: r.father_name ?? "",
    mother_name: r.mother_name ?? "",
    date_of_birth: longDate(r.date_of_birth),
    gender: r.gender ? r.gender[0].toUpperCase() + r.gender.slice(1) : "",
    roll_no: r.roll_no,
    registration_no: r.registration_no,
    institute_name: r.institute_name,
    institute_code: r.institute_code,
    institute_registration_no: r.institute_registration_no ?? "",
    course_title: r.course_title,
    course_code: r.course_code ?? "",
    course_duration: courseDuration(r.course_duration_months, r.course_duration_override),
    session_name: r.session_name,
    exam_name: r.exam_name,
    exam_code: r.exam_code,
    exam_date: longDate(r.exam_date),
    passing_year: r.passing_year ? String(r.passing_year) : r.is_pass && r.exam_date ? r.exam_date.slice(0, 4) : "",
    published_on: longDate(r.display_published_on),
    theory_marks: num(r.theory_marks),
    practical_marks: num(r.practical_marks),
    viva_marks: num(r.viva_marks),
    total_marks: num(r.total_marks),
    full_marks: num(r.full_marks),
    percentage: num(r.percentage),
    grade: r.grade,
    grade_point: num(r.grade_point, 2),
    scale_max: num(r.scale_max_point ?? 5, 2),
    gpa_text: gpaText(r.grade_point, r.scale_max_point),
    result_status: r.is_pass ? "Passed" : "Failed",
    grading_text: gradingText(r.grading_rules),
    verify_code: r.verify_code,
    verify_url: `${siteUrl.replace(/\/$/, "")}/verify?r=${r.verify_code}&v=${r.version}`,
  };
  const marks: MarksRow = {
    theory: num(r.theory_marks),
    practical: Number(r.practical_full) > 0 ? num(r.practical_marks) : "N/A",
    viva: Number(r.viva_full) > 0 ? num(r.viva_marks) : "N/A",
    total: num(r.total_marks),
    full: num(r.full_marks),
    grade: r.grade,
    point: num(r.grade_point, 2),
  };
  return { data, marks };
}
