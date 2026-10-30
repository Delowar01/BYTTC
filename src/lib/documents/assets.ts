import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

/** Organization logo as PNG/JPEG bytes (SVG/WebP logos are converted). */
export async function loadLogo(url: string | null | undefined) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > 3 * 1024 * 1024) return null;
    const type = res.headers.get("content-type") ?? "";
    if (/image\/(png|jpe?g)/.test(type)) return new Uint8Array(bytes);
    return new Uint8Array(await sharp(bytes).png().toBuffer());
  } catch {
    return null;
  }
}

/** Download a private file (photo, template background, signature) with the given client. */
export async function loadPrivate(client: SupabaseClient, bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await client.storage.from(bucket).download(path);
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}
