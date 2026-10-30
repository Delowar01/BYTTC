import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ResultFacts } from "@/lib/documents/data";

export type LookupMethod = "roll_reg" | "passport_roll" | "passport_reg";
export const LOOKUP_METHODS: LookupMethod[] = ["roll_reg", "passport_roll", "passport_reg"];

export type PublicRow = ResultFacts & { photo_path: string | null };

/**
 * Two-identifier lookup through the database function (service role, server
 * only). Returns published results with privacy-filtered personal details.
 */
export async function lookupRows(method: LookupMethod, first: string, second: string): Promise<PublicRow[] | null> {
  if (!LOOKUP_METHODS.includes(method)) return null;
  const { data, error } = await createAdminClient().rpc("public_result_lookup_v2", { p_method: method, p_first: first, p_second: second });
  if (error) throw new Error("Lookup failed");
  return data.map((r) => ({
    student_name: r.student_name,
    student_name_bn: r.student_name_bn,
    father_name: r.father_name,
    mother_name: r.mother_name,
    date_of_birth: r.date_of_birth,
    roll_no: r.roll_no,
    registration_no: r.registration_no,
    institute_name: r.institute_name,
    institute_code: r.institute_code,
    institute_registration_no: r.institute_registration_no,
    course_title: r.course_title,
    course_code: r.course_code,
    course_duration_months: r.course_duration_months,
    course_duration_override: r.course_duration_override,
    session_name: r.session_name,
    exam_name: r.exam_name,
    exam_code: r.exam_code,
    exam_date: r.exam_date,
    passing_year: r.passing_year,
    theory_marks: r.theory_marks,
    practical_marks: r.practical_marks,
    viva_marks: r.viva_marks,
    practical_full: Number(r.practical_full),
    viva_full: Number(r.viva_full),
    total_marks: r.total_marks,
    full_marks: r.full_marks,
    percentage: r.percentage,
    grade: r.grade,
    grade_point: r.grade_point,
    scale_max_point: r.scale_max_point,
    is_pass: r.is_pass,
    display_published_on: r.display_published_on,
    verify_code: r.verify_code,
    version: r.version,
    photo_path: r.photo_path,
  }));
}
