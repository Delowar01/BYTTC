"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { assertRole } from "@/lib/auth";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { optDate, optNumber, optText } from "@/lib/schemas";

function back(formData: FormData, msg: string): never {
  const qs = new URLSearchParams(String(formData.get("back") ?? ""));
  qs.set("msg", msg);
  redirect(`/admin/results?${qs.toString()}`);
}

/** Publish or unpublish the selected results (publishers only; enforced again in the database). */
export async function publishSelected(formData: FormData) {
  let session;
  try {
    session = await assertRole(PUBLISHERS);
  } catch (e) {
    back(formData, `Error: ${e instanceof Error ? e.message : "not permitted"}`);
  }
  const publish = formData.get("op") === "publish";
  const ids = formData.getAll("ids").map(String).filter((v) => z.uuid().safeParse(v).success);
  if (!ids.length) back(formData, "Select at least one result.");
  const { data, error } = await session.supabase.rpc("set_results_publication", { p_ids: ids, p_publish: publish });
  revalidatePath("/admin/results");
  if (error) back(formData, `Error: ${error.message}`);
  back(formData, `${(data as { affected: number }).affected} result(s) ${publish ? "published" : "unpublished"}.`);
}

const correctionSchema = z.object({
  theory_marks: optNumber(0, 1000),
  practical_marks: optNumber(0, 1000),
  viva_marks: optNumber(0, 1000),
  remarks: optText,
  display_published_on: optDate,
  grade_override: optText,
  grade_point_override: optNumber(0, 10),
  reason: optText,
});

/**
 * Edit a result. Drafts: any permitted user. Published/unpublished results and
 * grade overrides: central publishers with a mandatory reason (enforced again
 * by the database, which also recalculates totals and grades).
 */
export async function correctResult(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase, profile }) => {
    const values = formValues(formData);
    const parsed = correctionSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const { data: current } = await supabase.from("results").select("status, display_published_on, grade_override, grade_point_override").eq("id", id).maybeSingle();
    if (!current) return fail("Result not found.", values);
    const d = parsed.data;
    const publisher = PUBLISHERS.includes(profile.role);
    // Only publishers may change the displayed date or overrides; others keep the stored values.
    const displayDate = publisher ? d.display_published_on : current.display_published_on;
    const override = publisher ? d.grade_override : current.grade_override;
    const overridePoint = publisher ? d.grade_point_override : current.grade_point_override;
    const live = current.status === "published" || current.status === "unpublished";
    const overrideChanged = (override ?? null) !== (current.grade_override ?? null) || (overridePoint ?? null) !== (current.grade_point_override === null ? null : Number(current.grade_point_override));
    if ((live || overrideChanged) && !d.reason) return fail("A reason is required for this change (it is recorded in the audit log).", values, { reason: "Required" });
    const { error } = await supabase.rpc("correct_result_v2", {
      p_id: id,
      p_theory: d.theory_marks as number,
      p_practical: d.practical_marks as number,
      p_viva: d.viva_marks as number,
      p_remarks: d.remarks ?? "",
      p_display_published_on: displayDate as string,
      p_grade_override: override ?? "",
      p_grade_point_override: overridePoint as number,
      p_reason: d.reason ?? "",
    });
    if (error) return fail(error.message, values);
    revalidatePath("/admin/results");
    revalidatePath(`/admin/results/${id}`);
    return success("Result updated. Totals and grade recalculated.");
  });
}

/** Publish or unpublish one result (publishers; enforced again in the database). */
export async function setResultPublication(id: string, publish: boolean, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("set_results_publication", { p_ids: [id], p_publish: publish });
    if (error) return fail(error.message);
    revalidatePath(`/admin/results/${id}`);
    revalidatePath("/admin/results");
    return (data as { affected: number }).affected ? success(publish ? "Result published." : "Result unpublished.") : fail("Nothing to change.");
  });
}

const singleSchema = z.object({
  exam_id: z.uuid("Select an exam"),
  theory_marks: optNumber(0, 1000),
  practical_marks: optNumber(0, 1000),
  viva_marks: optNumber(0, 1000),
  remarks: optText,
  display_published_on: optDate,
});

/** Add one result without a spreadsheet. Saved as a draft; publishing is separate. */
export async function createSingleResult(studentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase, profile }) => {
    const values = formValues(formData);
    const parsed = singleSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const d = parsed.data;
    const [{ data: student }, { data: exam }, { data: existing }] = await Promise.all([
      supabase.from("students").select("id, institute_id, course_id").eq("id", studentId).maybeSingle(),
      supabase.from("exams").select("id, course_id, theory_full_marks, practical_full_marks, viva_full_marks").eq("id", d.exam_id).maybeSingle(),
      supabase.from("results").select("id").eq("student_id", studentId).eq("exam_id", d.exam_id).maybeSingle(),
    ]);
    if (!student) return fail("Student not found or not permitted.", values);
    if (!exam || exam.course_id !== student.course_id) return fail("Choose an exam of the student's course.", values, { exam_id: "Not this student's course" });
    if (existing) return fail("This student already has a result for this exam. Edit it instead of creating a duplicate.", values, { _existing: existing.id });
    const errors: Record<string, string> = {};
    const check = (key: "theory_marks" | "practical_marks" | "viva_marks", full: number, label: string) => {
      const v = d[key];
      if (full > 0 && v === null) errors[key] = `${label} marks are required`;
      else if (v !== null && v > full) errors[key] = `Exceeds full marks (${full})`;
    };
    check("theory_marks", Number(exam.theory_full_marks), "Written");
    check("practical_marks", Number(exam.practical_full_marks), "Practical");
    check("viva_marks", Number(exam.viva_full_marks), "Viva");
    if (Object.keys(errors).length) return fail("Please correct the highlighted fields.", values, errors);
    const { data, error } = await supabase
      .from("results")
      .insert({
        exam_id: d.exam_id,
        student_id: studentId,
        institute_id: student.institute_id,
        theory_marks: d.theory_marks,
        practical_marks: d.practical_marks,
        viva_marks: Number(exam.viva_full_marks) > 0 ? d.viva_marks : null,
        remarks: d.remarks,
        display_published_on: PUBLISHERS.includes(profile.role) ? d.display_published_on : null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) return fail(dbMessage(error), values);
    revalidatePath("/admin/results");
    redirect(`/admin/results/${data.id}?created=1`);
  });
}

export async function deleteResult(id: string, _prev: FormState): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const { data, error } = await supabase.from("results").delete().eq("id", id).select("id");
    if (error) return fail(error.message);
    if (!data?.length) return fail("Published results cannot be deleted (unpublish first), or you lack permission.");
    revalidatePath("/admin/results");
    redirect("/admin/results?msg=Result+deleted.");
  });
}
