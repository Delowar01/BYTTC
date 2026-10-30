"use server";

import { allowRequest } from "@/lib/client-key";
import { resultData } from "@/lib/documents/data";
import type { MarksRow } from "@/lib/documents/types";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOOKUP_METHODS, lookupRows, type LookupMethod } from "./lookup";

export type PublicResultView = { data: Record<string, string>; marks: MarksRow; isPass: boolean; photoUrl: string | null };
export type LookupState = {
  status: "idle" | "found" | "not_found" | "limited" | "invalid";
  method: LookupMethod;
  first?: string;
  second?: string;
  results?: PublicResultView[];
};

const ID = /^[A-Z0-9-]{3,20}$/;
const PASSPORT = /^[A-Z0-9]{5,20}$/;
const norm = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s/g, "").toUpperCase();

/**
 * Public result lookup with two identifiers. Runs server-side with the service
 * role so the per-client rate limit cannot be bypassed. The database function
 * returns published results only, never the passport number, and personal
 * details only when the privacy settings allow them. Every failure returns the
 * same "not found" answer.
 */
export async function lookupResult(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const method = (LOOKUP_METHODS as string[]).includes(String(formData.get("method"))) ? (formData.get("method") as LookupMethod) : "roll_reg";
  const first = norm(formData.get("first"));
  const second = norm(formData.get("second"));
  const echo = { method, first: String(formData.get("first") ?? ""), second: String(formData.get("second") ?? "") };
  const firstOk = method === "roll_reg" ? ID.test(first) : PASSPORT.test(first);
  if (!firstOk || !ID.test(second)) return { status: "invalid", ...echo };
  if (!(await allowRequest("result_lookup", 30, "10 minutes"))) return { status: "limited", ...echo };
  const rows = await lookupRows(method, first, second);
  if (!rows?.length) return { status: "not_found", ...echo };
  const admin = createAdminClient();
  const results = await Promise.all(
    rows.map(async (row) => {
      const { data, marks } = resultData(row, env.siteUrl);
      const photo = row.photo_path ? (await admin.storage.from("private-documents").createSignedUrl(row.photo_path, 300)).data?.signedUrl ?? null : null;
      return { data, marks, isPass: row.is_pass, photoUrl: photo };
    }),
  );
  return { status: "found", ...echo, results };
}
