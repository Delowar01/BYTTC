"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { CENTRAL, PUBLISHERS } from "@/lib/roles";
import { checkbox, code, optInt, optNumber, optText, reqText } from "@/lib/schemas";
import { resolveImageField } from "@/lib/storage";

const schema = z.object({
  code: code("Course code"),
  title_en: reqText("Title (English)", 200),
  title_bn: optText,
  summary_en: optText,
  summary_bn: optText,
  description_en: optText,
  description_bn: optText,
  duration_months: optInt(1, 60),
  fee: optNumber(0, 10_000_000),
  sort_order: optInt(-10_000, 10_000),
  is_published: checkbox,
});

export async function saveCourse(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CENTRAL, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = schema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const image = await resolveImageField(supabase, formData, "image_url", "courses");
    if (image.error) return fail(image.error, values, { image_url: image.error });
    const row = { ...parsed.data, sort_order: parsed.data.sort_order ?? 0, image_url: image.url };
    const { data, error } = id
      ? await supabase.from("courses").update(row).eq("id", id).select("id")
      : await supabase.from("courses").insert(row).select("id");
    if (error) return fail(dbMessage(error), values);
    if (!data?.length) return fail("Course not found or not permitted.", values);
    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    redirect("/admin/courses?saved=1");
  });
}

export async function deleteCourse(id: string, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.from("courses").delete().eq("id", id).select("id");
    if (error) return fail(dbMessage(error));
    if (!data?.length) return fail("Course not found or not permitted.");
    revalidatePath("/admin/courses");
    return success("Deleted.");
  });
}
