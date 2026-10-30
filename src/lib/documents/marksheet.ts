import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { loadLogo, loadPrivate } from "./assets";
import { orgData, resultData, SETTINGS_COLUMNS, type ResultFacts } from "./data";
import { renderDocumentPdf } from "./render";
import { activeTemplate } from "./templates";
import type { RenderPage } from "./types";

export const MARKSHEET_SELECT =
  "id, status, theory_marks, practical_marks, viva_marks, total_marks, full_marks, percentage, grade, grade_point, is_pass, display_published_on, verify_code, version, " +
  "students(name_en, name_bn, father_name, mother_name, date_of_birth, gender, roll_no, registration_no, passing_year, course_duration_override, photo_path), " +
  "exams(name, code, exam_date, practical_full_marks, viva_full_marks, courses(title_en, code, duration_months), academic_sessions(name)), " +
  "institutes(name_en, code, registration_no), grade_scales(max_point, rules)";

type Row = {
  theory_marks: number | null; practical_marks: number | null; viva_marks: number | null; total_marks: number; full_marks: number; percentage: number;
  grade: string; grade_point: number; is_pass: boolean; display_published_on: string | null; verify_code: string; version: number;
  students: { name_en: string; name_bn: string | null; father_name: string | null; mother_name: string | null; date_of_birth: string | null; gender: string | null; roll_no: string; registration_no: string; passing_year: number | null; course_duration_override: string | null; photo_path: string | null } | null;
  exams: { name: string; code: string; exam_date: string | null; practical_full_marks: number; viva_full_marks: number; courses: { title_en: string; code: string; duration_months: number | null } | null; academic_sessions: { name: string } | null } | null;
  institutes: { name_en: string; code: string; registration_no: string | null } | null;
  grade_scales: { max_point: number; rules: { min_percent: number; grade: string }[] } | null;
};

export function factsFromRow(r: Row): ResultFacts & { photo_path: string | null } {
  const s = r.students!;
  const e = r.exams!;
  return {
    student_name: s.name_en, student_name_bn: s.name_bn, father_name: s.father_name, mother_name: s.mother_name,
    date_of_birth: s.date_of_birth, gender: s.gender, roll_no: s.roll_no, registration_no: s.registration_no,
    institute_name: r.institutes?.name_en ?? "", institute_code: r.institutes?.code ?? "", institute_registration_no: r.institutes?.registration_no,
    course_title: e.courses?.title_en ?? "", course_code: e.courses?.code, course_duration_months: e.courses?.duration_months, course_duration_override: s.course_duration_override,
    session_name: e.academic_sessions?.name ?? "", exam_name: e.name, exam_code: e.code, exam_date: e.exam_date, passing_year: s.passing_year,
    theory_marks: r.theory_marks, practical_marks: r.practical_marks, viva_marks: r.viva_marks,
    practical_full: Number(e.practical_full_marks), viva_full: Number(e.viva_full_marks),
    total_marks: r.total_marks, full_marks: r.full_marks, percentage: r.percentage, grade: r.grade, grade_point: r.grade_point,
    scale_max_point: r.grade_scales?.max_point ?? null, is_pass: r.is_pass, display_published_on: r.display_published_on,
    verify_code: r.verify_code, version: r.version, grading_rules: r.grade_scales?.rules, photo_path: s.photo_path,
  };
}

/** Render marksheets for result facts using the active marksheet template. */
export async function renderMarksheets(
  client: SupabaseClient,
  items: (ResultFacts & { photo_path: string | null; overlay?: string })[],
  photoClient: SupabaseClient,
) {
  const [{ data: settings }, template] = await Promise.all([client.from("site_settings").select(SETTINGS_COLUMNS).eq("id", 1).single(), activeTemplate(client, "marksheet")]);
  const s = settings as unknown as Parameters<typeof orgData>[0] & { logo_url: string | null };
  const org = orgData(s);
  const pages: RenderPage[] = [];
  for (const item of items) {
    const { data, marks } = resultData(item, env.siteUrl);
    pages.push({
      layout: template.layout,
      background: template.background,
      assets: template.assets,
      data: { ...org, ...data },
      marks,
      photo: await loadPrivate(photoClient, "private-documents", item.photo_path),
      overlay: item.overlay,
    });
  }
  return renderDocumentPdf(pages, { title: "Result sheet", author: s.org_name_en, logo: await loadLogo(s.logo_url) });
}
