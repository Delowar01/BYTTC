"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { PUBLISHERS } from "@/lib/roles";
import { reqNumber, reqText } from "@/lib/schemas";

const schema = z.object({
  min_percent: reqNumber("Minimum %", 0, 100),
  grade: reqText("Grade", 5),
  grade_point: reqNumber("Grade point", 0, 5),
});

export async function saveGradeRule(id: number | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = schema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const { error } = id ? await supabase.from("grade_rules").update(parsed.data).eq("id", id) : await supabase.from("grade_rules").insert(parsed.data);
    if (error) return fail(dbMessage(error), values);
    revalidatePath("/admin/grading");
    return success("Saved.");
  });
}

export async function deleteGradeRule(id: number, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { error } = await supabase.from("grade_rules").delete().eq("id", id);
    if (error) return fail(dbMessage(error));
    revalidatePath("/admin/grading");
    return success("Deleted.");
  });
}
