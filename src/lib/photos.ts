import "server-only";
import sharp from "sharp";
import type { Session } from "@/lib/auth";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 150;
const MAX_SIDE = 8000;

/**
 * Validate an uploaded student photo and normalize it: honour EXIF
 * orientation, cap the size, strip metadata (e.g. GPS) and store as JPEG so
 * every document generator can embed it.
 */
export async function normalizePhoto(file: File): Promise<{ bytes: Buffer } | { error: string }> {
  if (!PHOTO_TYPES.includes(file.type)) return { error: "Use a JPG, PNG or WebP photo." };
  if (file.size === 0 || file.size > MAX_BYTES) return { error: "The photo must be smaller than 5 MB." };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input).metadata();
    const w = meta.autoOrient?.width ?? meta.width ?? 0;
    const h = meta.autoOrient?.height ?? meta.height ?? 0;
    if (w < MIN_SIDE || h < MIN_SIDE) return { error: `The photo is too small (minimum ${MIN_SIDE}×${MIN_SIDE} pixels).` };
    if (w > MAX_SIDE || h > MAX_SIDE) return { error: `The photo is too large (maximum ${MAX_SIDE} pixels per side).` };
    const bytes = await sharp(input).rotate().resize(600, 800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { bytes };
  } catch {
    return { error: "The file is not a readable image." };
  }
}

/** Short-lived signed URL for a private photo (null when there is none or access is denied). */
export async function photoUrl(supabase: Session["supabase"], path: string | null, seconds = 300) {
  if (!path) return null;
  const { data } = await supabase.storage.from("private-documents").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** "4 Years", "6 Months" — or the student's recorded override. */
export function courseDuration(months: number | null | undefined, override?: string | null) {
  if (override) return override;
  if (!months) return "";
  if (months % 12 === 0) return `${months / 12} Year${months === 12 ? "" : "s"}`;
  return `${months} Month${months === 1 ? "" : "s"}`;
}
