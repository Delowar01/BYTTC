"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, formValues, type FormState } from "@/lib/forms";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail("Enter your email and password.", { email: values.email ?? "" });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return fail("Invalid email or password.", { email: parsed.data.email });

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return fail("This account is not active. Contact the central office.", { email: parsed.data.email });
  }
  await supabase.rpc("log_event", { p_action: "auth.login", p_table: "profiles", p_record_id: data.user.id });

  const next = parsed.data.next;
  redirect(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
