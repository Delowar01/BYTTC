"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { fail, success, type FormState } from "@/lib/forms";
import { PUBLISHERS } from "@/lib/roles";

function refresh() {
  revalidatePath("/admin/certificates");
  revalidatePath("/admin/results");
}

export async function issueForExam(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const exam = z.uuid().safeParse(formData.get("exam"));
    if (!exam.success) return fail("Select an exam.");
    const { data, error } = await supabase.rpc("issue_exam_certificates", { p_exam_id: exam.data });
    if (error) return fail(error.message);
    refresh();
    const r = data as { issued: number; skipped: number };
    return success(`${r.issued} certificate(s) issued${r.skipped ? `, ${r.skipped} skipped (already issued)` : ""}.`);
  });
}

export async function issueForResult(resultId: string, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("issue_certificates", { p_result_ids: [resultId] });
    if (error) return fail(error.message);
    refresh();
    revalidatePath(`/admin/results/${resultId}`);
    const r = data as { issued: number };
    return r.issued ? success("Certificate issued.") : fail("Not eligible: the result must be published, passed and without a valid certificate.");
  });
}

export async function revokeCertificate(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("revoke_certificate", { p_id: id, p_reason: String(formData.get("reason") ?? "") });
    if (error) return fail(error.message);
    refresh();
    return success(`Certificate ${(data as { certificate_no: string }).certificate_no} revoked.`);
  });
}

export async function reissueCertificate(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("reissue_certificate", { p_id: id, p_reason: String(formData.get("reason") ?? "") });
    if (error) return fail(error.message);
    refresh();
    return success(`Reissued as ${(data as { certificate_no: string }).certificate_no}.`);
  });
}
