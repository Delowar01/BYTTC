"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { SUPER } from "@/lib/roles";
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

/** Create a staff account. Uses the service role ONLY after the super-admin check. */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(SUPER, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = baseSchema.safeParse(values);
    const email = z.email("Enter a valid email").safeParse(values.email?.toLowerCase());
    const pw = password.safeParse(values.password ?? "");
    if (!parsed.success) return zodFail(parsed.error, values);
    if (!email.success) return fail("Please correct the highlighted fields.", values, { email: "Enter a valid email" });
    if (!pw.success) return fail("Please correct the highlighted fields.", values, { password: pw.error.issues[0].message });

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email: email.data, password: pw.data, email_confirm: true });
    if (error || !data.user) return fail(error?.message ?? "Could not create the user.", values);
    const role = parsed.data.role;
    const { error: pErr } = await admin.from("profiles").insert({
      id: data.user.id,
      email: email.data,
      full_name: parsed.data.full_name,
      role,
      institute_id: role.startsWith("institute_") ? parsed.data.institute_id : null,
      is_active: parsed.data.is_active,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail(dbMessage(pErr), values);
    }
    await supabase.rpc("log_event", { p_action: "user.create", p_table: "profiles", p_record_id: data.user.id, p_data: { email: email.data, role } });
    revalidatePath("/admin/users");
    redirect("/admin/users?saved=1");
  });
}

export async function updateUser(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(SUPER, async ({ supabase, user }) => {
    const values = formValues(formData);
    const parsed = baseSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    if (id === user.id && (!parsed.data.is_active || parsed.data.role !== "super_admin")) {
      return fail("You cannot deactivate or demote your own account.", values);
    }
    const role = parsed.data.role;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, role, institute_id: role.startsWith("institute_") ? parsed.data.institute_id : null, is_active: parsed.data.is_active })
      .eq("id", id);
    if (error) return fail(dbMessage(error), values);
    if (values.password) {
      const pw = password.safeParse(values.password);
      if (!pw.success) return fail("Please correct the highlighted fields.", values, { password: pw.error.issues[0].message });
      const { error: e } = await createAdminClient().auth.admin.updateUserById(id, { password: pw.data });
      if (e) return fail(e.message, values);
      await supabase.rpc("log_event", { p_action: "user.password_reset", p_table: "profiles", p_record_id: id });
    }
    revalidatePath("/admin/users");
    return success("User updated.");
  });
}
