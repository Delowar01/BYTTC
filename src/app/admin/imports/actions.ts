"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withRole } from "@/lib/actions";
import { fail, type FormState } from "@/lib/forms";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";

/** Status changes swap the visible buttons, so report success at page level. */
function done(id: string, message: string): never {
  redirect(`/admin/imports/${id}?msg=${encodeURIComponent(message)}`);
}

function refresh(id: string) {
  revalidatePath(`/admin/imports/${id}`);
  revalidatePath("/admin/imports");
  revalidatePath("/admin/results");
  revalidatePath("/admin");
}

export async function commitBatch(id: string, kind: string, _prev: FormState): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const { data, error } = await supabase.rpc(kind === "students" ? "commit_student_batch" : "commit_result_batch", { p_batch_id: id });
    refresh(id);
    if (error) return fail(error.message);
    const res = data as { ok: boolean; inserted?: number; error?: string };
    if (!res.ok) return fail(`Commit failed and nothing was saved: ${res.error}`);
    done(id, kind === "students" ? `${res.inserted} students created.` : `${res.inserted} results saved as draft.`);
  });
}

export async function setBatchPublication(id: string, publish: boolean, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data, error } = await supabase.rpc("set_batch_publication", { p_batch_id: id, p_publish: publish });
    refresh(id);
    if (error) return fail(error.message);
    done(id, `${(data as { affected: number }).affected} results ${publish ? "published" : "unpublished"}.`);
  });
}

export async function rollbackBatch(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) return fail("A reason is required.");
    const { data, error } = await supabase.rpc("rollback_result_batch", { p_batch_id: id, p_reason: reason });
    refresh(id);
    if (error) return fail(error.message);
    done(id, `Rolled back: ${(data as { deleted: number }).deleted} results removed.`);
  });
}

export async function discardBatch(id: string, _prev: FormState): Promise<FormState> {
  return withRole(ALL_STAFF, async ({ supabase }) => {
    const { error } = await supabase.rpc("discard_batch", { p_batch_id: id });
    refresh(id);
    if (error) return fail(error.message);
    done(id, "Batch discarded.");
  });
}
