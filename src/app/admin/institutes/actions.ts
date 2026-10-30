"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { CENTRAL, PUBLISHERS, SUPER } from "@/lib/roles";
import { code, optEmail, optInt, optText, reqText } from "@/lib/schemas";
import type { Database } from "@/lib/database.types";

type InstituteStatus = Database["public"]["Enums"]["institute_status"];

const schema = z.object({
  code: code("Institute code"),
  name_en: reqText("Name (English)", 200),
  name_bn: optText,
  head_name: optText,
  email: optEmail,
  phone: optText,
  address: optText,
  district: optText,
  established_year: optInt(1900, 2100),
  remarks: optText,
});

export async function saveInstitute(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CENTRAL, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = schema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const { data, error } = id
      ? await supabase.from("institutes").update(parsed.data).eq("id", id).select("id")
      : await supabase.from("institutes").insert(parsed.data).select("id");
    if (error) return fail(dbMessage(error), values);
    if (!data?.length) return fail("Institute not found or not permitted.", values);
    revalidatePath("/admin/institutes");
    revalidatePath("/institutes");
    redirect(`/admin/institutes/${data[0].id}?saved=1`);
  });
}

const TRANSITIONS: Record<InstituteStatus, InstituteStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved"],
  rejected: ["approved"],
};

/** Approval workflow: pending → approved/rejected; approved ⇄ suspended. */
export async function setInstituteStatus(id: string, status: InstituteStatus, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase, user }) => {
    const reason = String(formData.get("reason") ?? "").trim();
    if (status !== "approved" && !reason) return fail("A reason is required.");
    const { data: current } = await supabase.from("institutes").select("status").eq("id", id).maybeSingle();
    if (!current) return fail("Institute not found.");
    if (!TRANSITIONS[current.status].includes(status)) return fail(`Cannot change status from ${current.status} to ${status}.`);
    const patch =
      status === "approved"
        ? { status, approved_at: new Date().toISOString(), approved_by: user.id, remarks: reason || null }
        : { status, remarks: reason };
    const { error } = await supabase.from("institutes").update(patch).eq("id", id);
    if (error) return fail(dbMessage(error));
    await supabase.rpc("log_event", { p_action: `institute.${status}`, p_table: "institutes", p_record_id: id, p_reason: reason || undefined });
    revalidatePath("/admin/institutes");
    revalidatePath(`/admin/institutes/${id}`);
    revalidatePath("/institutes");
    return success(`Institute ${status}.`);
  });
}

export async function deleteInstitute(id: string, _prev: FormState): Promise<FormState> {
  return withRole(SUPER, async ({ supabase }) => {
    const { data, error } = await supabase.from("institutes").delete().eq("id", id).select("id");
    if (error) return fail(dbMessage(error));
    if (!data?.length) return fail("Not found or not permitted.");
    revalidatePath("/admin/institutes");
    redirect("/admin/institutes");
  });
}
