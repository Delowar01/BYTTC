"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { CENTRAL, PUBLISHERS } from "@/lib/roles";
import { checkbox, optDate, reqText } from "@/lib/schemas";

const schema = z
  .object({ name: reqText("Name", 100), start_date: optDate, end_date: optDate, is_active: checkbox })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  });

export async function saveSession(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CENTRAL, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = schema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const { data, error } = id
      ? await supabase.from("academic_sessions").update(parsed.data).eq("id", id).select("id")
      : await supabase.from("academic_sessions").insert(parsed.data).select("id");
    if (error) return fail(dbMessage(error), values);
    if (!data?.length) return fail("Session not found or not permitted.", values);
    revalidatePath("/admin/sessions");
    redirect("/admin/sessions?saved=1");
  });
}

export async function deleteSession(id: string, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.from("academic_sessions").delete().eq("id", id).select("id");
    if (error) return fail(dbMessage(error));
    if (!data?.length) return fail("Not found or not permitted.");
    revalidatePath("/admin/sessions");
    return success("Deleted.");
  });
}
