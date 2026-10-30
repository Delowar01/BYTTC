"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { assertRole } from "@/lib/auth";
import { fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { optNumber, optText } from "@/lib/schemas";

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
  remarks: optText,
  reason: optText,
});

/** Edit marks. Draft results: any permitted user. Published: publishers + mandatory reason. */
export async function correctResult(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = correctionSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const { data: current } = await supabase.from("results").select("status").eq("id", id).maybeSingle();
    if (!current) return fail("Result not found.", values);
    const live = current.status === "published" || current.status === "unpublished";
    if (live && !parsed.data.reason) return fail("A reason is required to correct a published result.", values, { reason: "Required" });
    const { error } = await supabase.rpc("correct_result", {
      p_id: id,
      p_theory: parsed.data.theory_marks as number,
      p_practical: parsed.data.practical_marks as number,
      p_remarks: parsed.data.remarks ?? "",
      p_reason: parsed.data.reason ?? "",
    });
    if (error) return fail(error.message, values);
    revalidatePath("/admin/results");
    revalidatePath(`/admin/results/${id}`);
    return success("Result updated. Grade recalculated.");
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
