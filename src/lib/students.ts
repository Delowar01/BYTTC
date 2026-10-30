import "server-only";
import type { Session } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { escapeLike } from "@/lib/utils";

export type StudentFilters = { q: string; institute: string; course: string; session: string; status: string };
type StudentStatus = Database["public"]["Enums"]["student_status"];
const STATUSES = ["active", "completed", "dropped"];

export function readStudentFilters(sp: Record<string, string | string[] | undefined>): StudentFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return { q: s("q"), institute: s("institute"), course: s("course"), session: s("session"), status: STATUSES.includes(s("status")) ? s("status") : "" };
}

export const STUDENT_LIST_COLUMNS =
  "id, roll_no, registration_no, name_en, name_bn, father_name, mother_name, date_of_birth, gender, phone, email, address, status, created_at, institute_id, course_id, session_id, institutes(code, name_en), courses(code, title_en), academic_sessions(name)";

/** Student query with filters applied; RLS limits tenants to their own rows. */
export function studentQuery(supabase: Session["supabase"], f: StudentFilters, count = false) {
  let q = supabase
    .from("students")
    .select(STUDENT_LIST_COLUMNS, count ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false })
    .order("roll_no");
  if (f.q) {
    const t = escapeLike(f.q);
    q = q.or(`name_en.ilike.%${t}%,name_bn.ilike.%${t}%,roll_no.ilike.%${t}%,registration_no.ilike.%${t}%,phone.ilike.%${t}%`);
  }
  if (f.institute) q = q.eq("institute_id", f.institute);
  if (f.course) q = q.eq("course_id", f.course);
  if (f.session) q = q.eq("session_id", f.session);
  if (f.status) q = q.eq("status", f.status as StudentStatus);
  return q;
}
