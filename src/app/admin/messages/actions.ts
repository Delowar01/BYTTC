"use server";

import { revalidatePath } from "next/cache";
import { withRole } from "@/lib/actions";
import { fail, success, type FormState } from "@/lib/forms";
import { CENTRAL, CMS_EDITORS } from "@/lib/roles";

export async function markMessage(id: string, read: boolean, _prev: FormState): Promise<FormState> {
  return withRole(CENTRAL, async ({ supabase }) => {
    const { error } = await supabase.from("contact_messages").update({ is_read: read }).eq("id", id);
    if (error) return fail(error.message);
    revalidatePath("/admin/messages");
    return success(read ? "Marked read." : "Marked unread.");
  });
}

export async function deleteMessage(id: string, _prev: FormState): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) return fail(error.message);
    revalidatePath("/admin/messages");
    return success("Deleted.");
  });
}
