"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { USER_MANAGERS, type AppRole } from "@/lib/roles";
import { checkbox, optText } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["super_admin", "central_admin", "central_staff", "institute_admin", "institute_staff"] as const;
const password = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lower-case letter")
  .regex(/[A-Z]/, "Needs an upper-case letter")
  .regex(/[0-9]/, "Needs a digit");

const baseSchema = z
  .object({
    full_name: z.string().trim().min(2, "Name is required").max(120),
    role: z.enum(ROLES),
    institute_id: optText,
    is_active: checkbox,
  })
  .refine((v) => (v.role.startsWith("institute_") ? !!v.institute_id : true), { message: "Institute users need an institute", path: ["institute_id"] });

/**
 * Who may create/manage which accounts:
 * - Super Admin: any account
 * - Central Admin: institute accounts (activation after approval)
 * - Institute Admin: staff accounts of their own institute only
 */
function mayManage(actor: Session["profile"], role: AppRole, instituteId: string | null) {
  if (actor.role === "super_admin") return true;
  if (actor.role === "central_admin") return role === "institute_admin" || role === "institute_staff";
  if (actor.role === "institute_admin") return role === "institute_staff" && instituteId === actor.institute_id;
  return false;
}

/** Create a staff account. The service role is used ONLY after the permission check. */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(USER_MANAGERS, async ({ supabase, profile }) => {
    const values = formValues(formData);
    if (profile.role === "institute_admin") {
      values.role = "institute_staff";
      values.institute_id = profile.institute_id ?? "";
    }
    const parsed = baseSchema.safeParse(values);
    const email = z.email("Enter a valid email").safeParse(values.email?.toLowerCase());
    const pw = password.safeParse(values.password ?? "");
    if (!parsed.success) return zodFail(parsed.error, values);
    if (!email.success) return fail("Please correct the highlighted fields.", values, { email: "Enter a valid email" });
    if (!pw.success) return fail("Please correct the highlighted fields.", values, { password: pw.error.issues[0].message });
    const role = parsed.data.role;
    const instituteId = role.startsWith("institute_") ? parsed.data.institute_id : null;
    if (!mayManage(profile, role, instituteId)) return fail("You are not allowed to create this type of account.", values);

    const admin = createAdminClient();
    if (instituteId) {
      const { data: inst } = await admin.from("institutes").select("status").eq("id", instituteId).maybeSingle();
      if (inst?.status !== "approved") return fail("Accounts can only be created for approved institutes.", values);
    }
    const { data, error } = await admin.auth.admin.createUser({ email: email.data, password: pw.data, email_confirm: true });
    if (error || !data.user) return fail(error?.message ?? "Could not create the user.", values);
    const { error: pErr } = await admin.from("profiles").insert({
      id: data.user.id,
      email: email.data,
      full_name: parsed.data.full_name,
      role,
      institute_id: instituteId,
      is_active: parsed.data.is_active,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail(dbMessage(pErr), values);
    }
    await supabase.rpc("log_event", { p_action: "user.create", p_table: "profiles", p_record_id: data.user.id, p_data: { email: email.data, role, institute_id: instituteId } });
    revalidatePath("/admin/users");
    if (instituteId) revalidatePath(`/admin/institutes/${instituteId}`);
    const back = String(formData.get("back") ?? "");
    redirect(back.startsWith("/admin/") ? `${back}${back.includes("?") ? "&" : "?"}account=1` : "/admin/users?saved=1");
  });
}

export async function updateUser(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(USER_MANAGERS, async ({ supabase, user, profile }) => {
    const values = formValues(formData);
    const admin = createAdminClient();
    const { data: target } = await admin.from("profiles").select("role, institute_id").eq("id", id).maybeSingle();
    if (!target || !mayManage(profile, target.role, target.institute_id)) return fail("You are not allowed to manage this account.", values);
    if (profile.role === "institute_admin") {
      values.role = "institute_staff";
      values.institute_id = profile.institute_id ?? "";
    }
    const parsed = baseSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const role = parsed.data.role;
    const instituteId = role.startsWith("institute_") ? parsed.data.institute_id : null;
    if (!mayManage(profile, role, instituteId)) return fail("You are not allowed to assign this role.", values);
    if (id === user.id && (!parsed.data.is_active || parsed.data.role !== profile.role)) {
      return fail("You cannot deactivate or change the role of your own account.", values);
    }
    const { error } = await admin
      .from("profiles")
      .update({ full_name: parsed.data.full_name, role, institute_id: instituteId, is_active: parsed.data.is_active })
      .eq("id", id);
    if (error) return fail(dbMessage(error), values);
    if (values.password) {
      const pw = password.safeParse(values.password);
      if (!pw.success) return fail("Please correct the highlighted fields.", values, { password: pw.error.issues[0].message });
      const { error: e } = await admin.auth.admin.updateUserById(id, { password: pw.data });
      if (e) return fail(e.message, values);
      await supabase.rpc("log_event", { p_action: "user.password_reset", p_table: "profiles", p_record_id: id });
    }
    await supabase.rpc("log_event", { p_action: "user.update", p_table: "profiles", p_record_id: id, p_data: { role, institute_id: instituteId, is_active: parsed.data.is_active } });
    revalidatePath("/admin/users");
    return success("User updated.");
  });
}
