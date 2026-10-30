"use server";

import { z } from "zod";
import { allowRequest } from "@/lib/client-key";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { status: "idle" | "sent" | "invalid" | "limited" };

/** Always reports "sent" for valid input so the form cannot reveal which emails exist. */
export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "invalid" };
  if (!(await allowRequest("password_reset", 5, "1 hour"))) return { status: "limited" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${env.siteUrl}/reset-password` });
  return { status: "sent" };
}
