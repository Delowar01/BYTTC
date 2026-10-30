"use server";

import { redirect } from "next/navigation";
import { withRole } from "@/lib/actions";
import { fail, type FormState } from "@/lib/forms";
import { stageImport } from "@/lib/import/stage";
import { ALL_STAFF } from "@/lib/roles";

export async function uploadStudents(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(ALL_STAFF, async (session) => {
    const outcome = await stageImport("students", session, formData.get("file"));
    if ("error" in outcome) return fail(outcome.error);
    redirect(`/admin/imports/${outcome.batchId}`);
  });
}
