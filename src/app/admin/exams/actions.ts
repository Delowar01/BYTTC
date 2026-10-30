"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { CENTRAL, PUBLISHERS } from "@/lib/roles";
import { checkbox, code, optDate, reqNumber, reqText, uuid } from "@/lib/schemas";

const schema = z
  .object({
    code: code("Exam code", 30),
    name: reqText("Name", 200),
    course_id: uuid("Course"),
    session_id: uuid("Session"),
    exam_date: optDate,
    theory_full_marks: reqNumber("Theory full marks", 0, 1000),
    practical_full_marks: reqNumber("Practical full marks", 0, 1000),
    viva_full_marks: reqNumber("Viva full marks", 0, 1000),
    pass_marks: reqNumber("Pass marks", 0, 3000),
    grade_scale_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, "Choose a grading scale"),
    is_active: checkbox,
  })
  .refine((v) => v.theory_full_marks + v.practical_full_marks + v.viva_full_marks > 0, {
    message: "Full marks must be greater than zero",
    path: ["theory_full_marks"],
  })
  .refine((v) => v.pass_marks <= v.theory_full_marks + v.practical_full_marks + v.viva_full_marks, {
    message: "Pass marks cannot exceed total full marks",
    path: ["pass_marks"],
  });

export async function saveExam(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CENTRAL, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = schema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const { data, error } = id
      ? await supabase.from("exams").update(parsed.data).eq("id", id).select("id")
      : await supabase.from("exams").insert(parsed.data).select("id");
    if (error) return fail(dbMessage(error), values);
    if (!data?.length) return fail("Exam not found or not permitted.", values);
    revalidatePath("/admin/exams");
    redirect("/admin/exams?saved=1");
  });
}

export async function deleteExam(id: string, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.from("exams").delete().eq("id", id).select("id");
    if (error) return fail(dbMessage(error));
    if (!data?.length) return fail("Not found or not permitted.");
    revalidatePath("/admin/exams");
    return success("Deleted.");
  });
}
