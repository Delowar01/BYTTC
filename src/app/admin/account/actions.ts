"use server";

import { z } from "zod";
import { withRole } from "@/lib/actions";
import { fail, success, type FormState } from "@/lib/forms";
import { ALL_STAFF } from "@/lib/roles";

const password = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lower-case letter")
  .regex(/[A-Z]/, "Needs an upper-case letter")
  .regex(/[0-9]/, "Needs a digit");

/** Change own password; the current password is re-verified first. */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase, user }) => {
    const current = String(formData.get("current_password") ?? "");
    const next = password.safeParse(String(formData.get("new_password") ?? ""));
    if (!next.success) return fail("Please correct the highlighted fields.", undefined, { new_password: next.error.issues[0].message });
    if (formData.get("confirm_password") !== next.data) return fail("Please correct the highlighted fields.", undefined, { confirm_password: "Passwords do not match" });
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email!, password: current });
    if (authError) return fail("Please correct the highlighted fields.", undefined, { current_password: "Current password is incorrect" });
    const { error } = await supabase.auth.updateUser({ password: next.data });
    if (error) return fail(error.message);
    await supabase.rpc("log_event", { p_action: "user.password_change", p_table: "profiles", p_record_id: user.id });
    return success("Password changed.");
  });
}
