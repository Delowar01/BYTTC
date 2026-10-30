"use server";

import { z } from "zod";
import { allowRequest } from "@/lib/client-key";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type PublicResult = Database["public"]["Functions"]["public_result_lookup"]["Returns"][number];
export type LookupState = { status: "idle" | "found" | "not_found" | "limited" | "invalid"; results?: PublicResult[]; roll?: string; registration?: string };

const ident = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/);

/**
 * Public result lookup. Runs server-side with the service role so the
 * per-client rate limit cannot be bypassed; the database function returns only
 * published results and only public fields.
 */
export async function lookupResult(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const roll = ident.safeParse(formData.get("roll"));
  const registration = ident.safeParse(formData.get("registration"));
  const echo = { roll: String(formData.get("roll") ?? ""), registration: String(formData.get("registration") ?? "") };
  if (!roll.success || !registration.success) return { status: "invalid", ...echo };
  if (!(await allowRequest("result_lookup", 30, "10 minutes"))) return { status: "limited", ...echo };
  const { data, error } = await createAdminClient().rpc("public_result_lookup", { p_roll: roll.data, p_registration: registration.data });
  if (error) throw new Error("Lookup failed");
  return data.length ? { status: "found", results: data, ...echo } : { status: "not_found", ...echo };
}
