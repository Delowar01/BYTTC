import "server-only";
import type { Session } from "@/lib/auth";

export const GRADES = ["A+", "A", "A-", "B", "C", "F"];

export type ExamSummary = {
  code: string;
  name: string;
  total: number;
  byStatus: Record<string, number>;
  published: number;
  passed: number;
  grades: Record<string, number>;
};

/** Per-exam and per-institute result summaries (RLS-scoped). */
export async function loadResultReport(supabase: Session["supabase"]) {
  const [{ data: rows, error }, { data: students, error: sErr }] = await Promise.all([supabase.rpc("report_results", {}), supabase.rpc("report_students")]);
  if (error) throw new Error(error.message);
  if (sErr) throw new Error(sErr.message);
  const exams = new Map<string, ExamSummary>();
  const institutes = new Map<string, { code: string; name: string; students: number; published: number; passed: number }>();
  for (const s of students) {
    const inst = institutes.get(s.institute_code) ?? { code: s.institute_code, name: s.institute_name, students: 0, published: 0, passed: 0 };
    inst.students += Number(s.n);
    institutes.set(s.institute_code, inst);
  }
  for (const r of rows) {
    const n = Number(r.n);
    const e = exams.get(r.exam_code) ?? { code: r.exam_code, name: r.exam_name, total: 0, byStatus: {}, published: 0, passed: 0, grades: {} };
    e.total += n;
    e.byStatus[r.status] = (e.byStatus[r.status] ?? 0) + n;
    const inst = institutes.get(r.institute_code) ?? { code: r.institute_code, name: r.institute_name, students: 0, published: 0, passed: 0 };
    if (r.status === "published") {
      e.published += n;
      e.grades[r.grade] = (e.grades[r.grade] ?? 0) + n;
      inst.published += n;
      if (r.is_pass) {
        e.passed += n;
        inst.passed += n;
      }
    }
    exams.set(r.exam_code, e);
    institutes.set(r.institute_code, inst);
  }
  const sortByCode = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);
  return { exams: [...exams.values()].sort(sortByCode), institutes: [...institutes.values()].sort(sortByCode), students };
}

export const passRate = (passed: number, published: number) => (published ? `${((passed * 100) / published).toFixed(1)}%` : "—");
