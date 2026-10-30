import "server-only";
import type { Session } from "@/lib/auth";
import { normId, type ResultLookup } from "./results";
import type { StudentLookup } from "./students";

type Client = Session["supabase"];

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function referenceData(supabase: Client) {
  const [institutes, courses, exams, sessions] = await Promise.all([
    supabase.from("institutes").select("id, code, status"),
    supabase.from("courses").select("id, code"),
    supabase.from("exams").select("id, code, course_id, theory_full_marks, practical_full_marks, viva_full_marks, is_active"),
    supabase.from("academic_sessions").select("id, name"),
  ]);
  for (const r of [institutes, courses, exams, sessions]) if (r.error) throw new Error(r.error.message);
  return {
    institutes: new Map(institutes.data!.map((i) => [i.code, { id: i.id, status: i.status }])),
    courses: new Map(courses.data!.map((c) => [c.code, { id: c.id }])),
    exams: new Map(
      exams.data!.map((e) => [
        e.code,
        {
          id: e.id,
          course_id: e.course_id,
          theory_full_marks: Number(e.theory_full_marks),
          practical_full_marks: Number(e.practical_full_marks),
          viva_full_marks: Number(e.viva_full_marks),
          is_active: e.is_active,
        },
      ]),
    ),
    sessions: new Map(sessions.data!.map((s) => [s.name.toLowerCase(), { id: s.id }])),
  };
}

/** Everything validateResultRows needs, scoped by the caller's RLS. */
export async function loadResultLookup(supabase: Client, rows: Record<string, string>[]): Promise<ResultLookup> {
  const ref = await referenceData(supabase);
  const rolls = [...new Set(rows.map((r) => normId(r.roll_no)).filter(Boolean))];
  const students: ResultLookup["students"] = new Map();
  for (const part of chunks(rolls)) {
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_no, registration_no, name_en, institute_id, course_id")
      .in("roll_no", part);
    if (error) throw new Error(error.message);
    for (const s of data) students.set(s.roll_no, s);
  }
  const existing: ResultLookup["existing"] = new Map();
  for (const part of chunks([...students.values()].map((s) => s.id))) {
    const { data, error } = await supabase.from("results").select("student_id, exam_id, status").in("student_id", part);
    if (error) throw new Error(error.message);
    for (const r of data) existing.set(`${r.student_id}:${r.exam_id}`, r.status);
  }
  return { students, institutes: ref.institutes, courses: ref.courses, exams: ref.exams, existing };
}

export async function loadStudentLookup(
  supabase: Client,
  rows: Record<string, string>[],
  tenantInstituteId: string | null,
): Promise<StudentLookup> {
  const ref = await referenceData(supabase);
  const { data: assigned, error: aErr } = await supabase.from("institute_courses").select("institute_id, course_id");
  if (aErr) throw new Error(aErr.message);
  const rolls = [...new Set(rows.map((r) => normId(r.roll_no)).filter(Boolean))];
  const regs = [...new Set(rows.map((r) => normId(r.registration_no)).filter(Boolean))];
  const usedRolls = new Set<string>();
  const usedRegistrations = new Set<string>();
  const n = Math.max(rolls.length, regs.length);
  for (let i = 0; i < n; i += 500) {
    const { data, error } = await supabase.rpc("identifiers_in_use", {
      p_rolls: rolls.slice(i, i + 500),
      p_registrations: regs.slice(i, i + 500),
    });
    if (error) throw new Error(error.message);
    for (const d of data) (d.kind === "roll" ? usedRolls : usedRegistrations).add(d.value);
  }
  return {
    institutes: ref.institutes,
    courses: ref.courses,
    sessions: ref.sessions,
    assignments: new Set(assigned.map((a) => `${a.institute_id}:${a.course_id}`)),
    usedRolls,
    usedRegistrations,
    tenantInstituteId,
  };
}
