"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, type FormState } from "@/lib/forms";
import { parseMarks } from "@/lib/import/results";
import { ALL_STAFF } from "@/lib/roles";

/**
 * Save the marks grid. Every row is validated first; then new results are
 * inserted as drafts in one statement and changed drafts are updated.
 * Published results are never edited here (use the correction page).
 */
export async function saveMarks(examId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const values = formValues(formData);
    const { data: exam } = await supabase.from("exams").select("id, theory_full_marks, practical_full_marks, viva_full_marks").eq("id", examId).maybeSingle();
    if (!exam) return fail("Exam not found.", values);
    const studentIds = [...new Set(Object.keys(values).filter((k) => k.startsWith("t_")).map((k) => k.slice(2)))].filter((id) => z.uuid().safeParse(id).success);
    const [{ data: existing }, { data: students }] = await Promise.all([
      supabase.from("results").select("id, student_id, status, theory_marks, practical_marks, viva_marks, remarks").eq("exam_id", examId).in("student_id", studentIds),
      supabase.from("students").select("id, institute_id").in("id", studentIds),
    ]);
    const byStudent = new Map((existing ?? []).map((r) => [r.student_id, r]));
    const instituteOf = new Map((students ?? []).map((s) => [s.id, s.institute_id]));

    const errors: Record<string, string> = {};
    const vivaFull = Number(exam.viva_full_marks);
    const inserts: { exam_id: string; student_id: string; theory_marks: number | null; practical_marks: number | null; viva_marks: number | null; remarks: string | null; status: "draft"; institute_id: string }[] = [];
    const updates: { id: string; theory_marks: number | null; practical_marks: number | null; viva_marks: number | null; remarks: string | null }[] = [];
    for (const sid of studentIds) {
      const rawT = values[`t_${sid}`] ?? "";
      const rawP = values[`p_${sid}`] ?? "";
      const rawV = values[`v_${sid}`] ?? "";
      const remarks = (values[`r_${sid}`] ?? "").slice(0, 500) || null;
      const current = byStudent.get(sid);
      if (!current && rawT === "" && rawP === "" && rawV === "") continue; // untouched row
      if (current && !["draft", "submitted"].includes(current.status)) continue; // locked
      const t = parseMarks(rawT, Number(exam.theory_full_marks));
      const p = parseMarks(rawP, Number(exam.practical_full_marks));
      if (t.error) errors[`t_${sid}`] = t.error;
      if (p.error) errors[`p_${sid}`] = p.error;
      const v = parseMarks(rawV, vivaFull);
      if (v.error) errors[`v_${sid}`] = v.error;
      if (t.error || p.error || v.error) continue;
      const instituteId = instituteOf.get(sid);
      if (!instituteId) continue; // not visible to this user (RLS)
      if (!current) {
        // The database re-derives institute_id from the student; RLS checks it.
        inserts.push({ exam_id: examId, student_id: sid, theory_marks: t.value, practical_marks: p.value, viva_marks: v.value, remarks, status: "draft", institute_id: instituteId });
      } else if (
        (current.theory_marks === null ? null : Number(current.theory_marks)) !== t.value ||
        (current.practical_marks === null ? null : Number(current.practical_marks)) !== p.value ||
        (current.viva_marks === null ? null : Number(current.viva_marks)) !== v.value ||
        (current.remarks ?? null) !== remarks
      ) {
        updates.push({ id: current.id, theory_marks: t.value, practical_marks: p.value, viva_marks: v.value, remarks });
      }
    }
    if (Object.keys(errors).length) return fail(`${Object.keys(errors).length} mark(s) need attention. Nothing was saved.`, values, errors);

    if (inserts.length) {
      const { error } = await supabase.from("results").insert(inserts);
      if (error) return fail(dbMessage(error), values);
    }
    for (const u of updates) {
      const { id, ...patch } = u;
      const { error } = await supabase.from("results").update(patch).eq("id", id).in("status", ["draft", "submitted"]);
      if (error) return fail(dbMessage(error), values);
    }
    revalidatePath("/admin/results/entry");
    revalidatePath("/admin/results");
    return success(`Saved: ${inserts.length} new, ${updates.length} updated (drafts).`);
  });
}

/** Institute users hand their drafts to the central office for review. */
export async function submitForReview(examId: string, _prev: FormState): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("submit_results", { p_exam_id: examId });
    if (error) return fail(error.message);
    revalidatePath("/admin/results/entry");
    return success(`${(data as { submitted: number }).submitted} result(s) submitted for central review.`);
  });
}
