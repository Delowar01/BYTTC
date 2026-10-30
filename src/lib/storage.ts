import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
const MAX_IMAGE = 5 * 1024 * 1024;

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-").slice(-80);
}

/**
 * If the form carries a file in `<field>__file`, upload it to the public media
 * bucket and return its public URL; otherwise return the URL typed in `<field>`.
 */
export async function resolveImageField(
  supabase: SupabaseClient<Database>,
  formData: FormData,
  field: string,
  folder: string,
): Promise<{ url: string | null; error?: string }> {
  const file = formData.get(`${field}__file`);
  if (file instanceof File && file.size > 0) {
    const allowed = [...IMAGE_TYPES, ...(field.includes("attachment") ? ["application/pdf"] : [])];
    if (!allowed.includes(file.type)) return { url: null, error: "Unsupported file type." };
    if (file.size > MAX_IMAGE) return { url: null, error: "File is larger than 5 MB." };
    const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from("public-media").upload(path, file, { contentType: file.type });
    if (error) return { url: null, error: error.message };
    return { url: supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl };
  }
  const typed = formData.get(field);
  return { url: typeof typed === "string" && typed.trim() !== "" ? typed.trim() : null };
}
