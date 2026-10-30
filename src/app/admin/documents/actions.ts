"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { fail, success, type FormState } from "@/lib/forms";
import { PUBLISHERS } from "@/lib/roles";

const ids = z.array(z.uuid()).min(1, "Select at least one student.").max(1000);
const optionalDate = z.union([z.literal(""), z.iso.date()]);
const short = (max: number) => z.string().trim().max(max);

function refresh() {
  revalidatePath("/admin/admit-cards");
  revalidatePath("/admin/registration-cards");
  revalidatePath("/admin/documents/[id]", "page");
  revalidatePath("/admin/students/[id]", "page");
}

function issued(r: unknown, noun: string) {
  const { issued: n, skipped } = r as { issued: number; skipped: number };
  return success(`${n} ${noun}(s) issued${skipped ? `, ${skipped} skipped (already have a valid one)` : ""}.`);
}

export async function issueAdmitCards(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const exam = z.uuid().safeParse(formData.get("exam"));
    const students = ids.safeParse(formData.getAll("student"));
    const type = short(30).safeParse(formData.get("examinee_type") ?? "");
    if (!exam.success) return fail("Select an exam.");
    if (!students.success) return fail(students.error.issues[0].message);
    if (!type.success) return fail("Examinee type: at most 30 characters.");
    const seat = formData.get("seat_mode") === "roll" ? "{roll_no}" : "";
    const { data, error } = await supabase.rpc("issue_documents", {
      p_type: "admit_card",
      p_students: students.data,
      p_exam: exam.data,
      p_extra: { examinee_type: type.data || "Regular", seat_no: seat },
    });
    if (error) return fail(error.message);
    refresh();
    return issued(data, "admit card");
  });
}

export async function issueRegistrationCards(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const students = ids.safeParse(formData.getAll("student"));
    const validUntil = optionalDate.safeParse(formData.get("valid_until") ?? "");
    if (!students.success) return fail(students.error.issues[0].message);
    if (!validUntil.success) return fail("Enter a valid date.");
    const { data, error } = await supabase.rpc("issue_documents", {
      p_type: "registration_card",
      p_students: students.data,
      p_exam: null as unknown as string,
      p_extra: validUntil.data ? { valid_until: validUntil.data } : {},
    });
    if (error) return fail(error.message);
    refresh();
    return issued(data, "registration card");
  });
}

export async function revokeDocument(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("revoke_document", { p_id: id, p_reason: String(formData.get("reason") ?? "") });
    if (error) return fail(error.message);
    refresh();
    return success(`Document ${(data as { document_no: string }).document_no} revoked.`);
  });
}

/** Revokes the document and issues a fresh one from current data (optionally with corrected details). */
export async function reissueDocument(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let fresh = "";
  const state = await withRole(PUBLISHERS, async ({ supabase }) => {
    const reason = short(500).safeParse(formData.get("reason") ?? "");
    const validUntil = optionalDate.safeParse(formData.get("valid_until") ?? "");
    if (!reason.success || !reason.data) return fail("A reason is required.");
    if (!validUntil.success) return fail("Enter a valid date.");
    const extra: Record<string, string> = {};
    for (const key of ["seat_no", "examinee_type"] as const) {
      const v = formData.get(key);
      if (typeof v === "string") extra[key] = v.trim().slice(0, key === "seat_no" ? 20 : 30);
    }
    if (validUntil.data) extra.valid_until = validUntil.data;
    const { data, error } = await supabase.rpc("reissue_document", { p_id: id, p_reason: reason.data, p_extra: extra });
    if (error) return fail(error.message);
    refresh();
    const r = data as { id: string; document_no: string };
    if (formData.get("open") === "1") fresh = r.id;
    return success(`Reissued as ${r.document_no}.`);
  });
  if (fresh) redirect(`/admin/documents/${fresh}?reissued=1`);
  return state;
}
