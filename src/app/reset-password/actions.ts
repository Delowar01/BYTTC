"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const password = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lower-case letter")
  .regex(/[A-Z]/, "Needs an upper-case letter")
  .regex(/[0-9]/, "Needs a digit");

export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your reset link has expired. Request a new one.");
  const next = password.safeParse(String(formData.get("new_password") ?? ""));
  if (!next.success) return fail("Please correct the highlighted fields.", undefined, { new_password: next.error.issues[0].message });
  if (formData.get("confirm_password") !== next.data) return fail("Please correct the highlighted fields.", undefined, { confirm_password: "Passwords do not match" });
  const { error } = await supabase.auth.updateUser({ password: next.data });
  if (error) return fail(error.message);
  await supabase.rpc("log_event", { p_action: "user.password_reset_by_email", p_table: "profiles", p_record_id: user.id });
  // Sign out everywhere so any session started by an attacker is ended too.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reset=1");
}
