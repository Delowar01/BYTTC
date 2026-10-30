/** Client-safe mirror of the database grading (preview only — the database is authoritative). */
export type GradeRule = { min_percent: number; grade: string; point: number };

export function previewGrade(
  marks: { theory: number | null; practical: number | null; viva: number | null },
  exam: { theory_full: number; practical_full: number; viva_full: number; pass_marks: number },
  rules: GradeRule[],
) {
  const full = exam.theory_full + exam.practical_full + exam.viva_full;
  const total = (marks.theory ?? 0) + (marks.practical ?? 0) + (marks.viva ?? 0);
  const percentage = full > 0 ? Math.round((total * 10000) / full) / 100 : 0;
  const pass = total >= exam.pass_marks;
  const sorted = [...rules].sort((a, b) => b.min_percent - a.min_percent);
  const rule = pass ? sorted.find((r) => r.min_percent <= percentage) : sorted[sorted.length - 1];
  return { full, total, percentage, pass, grade: rule?.grade ?? "—", point: rule?.point ?? 0 };
}
