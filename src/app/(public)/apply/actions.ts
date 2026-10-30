"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { allowRequest } from "@/lib/client-key";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApplyState = { status: "idle" | "sent" | "invalid" | "limited" | "error"; reference?: string; errors?: Record<string, boolean>; message?: string };

const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_DOC = 2 * 1024 * 1024;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const schema = z.object({
  name_en: text(3, 200),
  name_bn: optional(200),
  head_name: text(2, 120),
  district: text(2, 60),
  address: text(5, 500),
  phone: text(6, 30),
  email: z.email().max(200),
  established_year: z.union([z.literal(""), z.coerce.number().int().min(1900).max(new Date().getFullYear())]).transform((v) => (v === "" ? null : v)),
  applicant_name: text(2, 120),
  applicant_email: z.email().max(200),
  applicant_phone: text(6, 30),
  application_note: optional(2000),
  website: z.string().max(0), // honeypot
});

/**
 * Public institute application. Stored as a PENDING institute (never visible
 * publicly until approved). Uses the service role after validation and a
 * per-client rate limit; documents go to the private bucket.
 */
export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const raw = Object.fromEntries(["name_en", "name_bn", "head_name", "district", "address", "phone", "email", "established_year", "applicant_name", "applicant_email", "applicant_phone", "application_note", "website"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = schema.safeParse(raw);
  const files = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  const errors: Record<string, boolean> = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), true]));
  if (files.length > 3 || files.some((f) => !DOC_TYPES.includes(f.type) || f.size > MAX_DOC)) errors.documents = true;
  if (!parsed.success || Object.keys(errors).length) return { status: "invalid", errors };
  if (!(await allowRequest("institute_application", 3, "1 hour"))) return { status: "limited" };

  const admin = createAdminClient();
  const { data: courses } = await admin.from("courses").select("code").eq("is_published", true);
  const allowed = new Set((courses ?? []).map((c) => c.code));
  const requested = formData.getAll("courses").map(String).filter((c) => allowed.has(c));
  const { website: _honeypot, ...fields } = parsed.data;
  const reference = `APP-${randomBytes(4).toString("hex").toUpperCase()}`;

  const { data: inst, error } = await admin
    .from("institutes")
    .insert({ ...fields, code: reference, status: "pending", requested_courses: requested, applied_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Could not save the application. Please try again later." };

  const paths: string[] = [];
  for (const file of files) {
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
    const path = `applications/${inst.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await admin.storage.from("private-documents").upload(path, file, { contentType: file.type });
    if (!upErr) paths.push(path);
  }
  if (paths.length) await admin.from("institutes").update({ documents: paths }).eq("id", inst.id);
  return { status: "sent", reference };
}
