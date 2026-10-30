import "server-only";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const MAX_BACKGROUND = 10 * 1024 * 1024;
const MAX_ASSET = 2 * 1024 * 1024;

type Orientation = "portrait" | "landscape";
export type NormalizedBackground = { bytes: Buffer; type: "png" | "jpeg" | "pdf"; contentType: string; orientation: Orientation };

/**
 * Validates and re-encodes an uploaded blank design. Images are auto-rotated,
 * stripped of metadata and capped at A4/300 dpi; PDFs are reduced to a fresh
 * single-page document (only the first page's drawing is ever used).
 */
export async function normalizeBackground(file: File): Promise<NormalizedBackground | { error: string }> {
  if (file.size > MAX_BACKGROUND) return { error: "The design file is larger than 10 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    try {
      const src = await PDFDocument.load(buf, { updateMetadata: false });
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(src, [0]);
      out.addPage(page);
      const { width, height } = page.getSize();
      return { bytes: Buffer.from(await out.save()), type: "pdf", contentType: "application/pdf", orientation: width > height ? "landscape" : "portrait" };
    } catch {
      return { error: "The PDF could not be read (it may be encrypted or damaged)." };
    }
  }
  try {
    const meta = await sharp(buf).metadata();
    if (meta.format !== "png" && meta.format !== "jpeg") return { error: "Upload a PNG, JPG or PDF design." };
    const pipeline = sharp(buf, { limitInputPixels: 80_000_000 }).rotate().resize(3508, 3508, { fit: "inside", withoutEnlargement: true });
    const { data, info } = await (meta.format === "png" ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 90 })).toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < 500) return { error: "The design is too small: use at least 500 px on the short side (A4 at 150 dpi is 1240 × 1754 px)." };
    return { bytes: data, type: meta.format, contentType: `image/${meta.format}`, orientation: info.width > info.height ? "landscape" : "portrait" };
  } catch {
    return { error: "Upload a PNG, JPG or PDF design." };
  }
}

/** Signature/stamp images: PNG (transparency kept), at most 1200 × 600 px. */
export async function normalizeAsset(file: File): Promise<{ bytes: Buffer } | { error: string }> {
  if (file.size > MAX_ASSET) return { error: "The image is larger than 2 MB." };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) return { error: "Upload a PNG, JPG or WebP image." };
    return { bytes: await sharp(buf).rotate().resize(1200, 600, { fit: "inside", withoutEnlargement: true }).png().toBuffer() };
  } catch {
    return { error: "Upload a PNG, JPG or WebP image." };
  }
}

/** A neutral silhouette used as the photo in template previews. */
export async function samplePhoto() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#dfe6e6"/><circle cx="150" cy="150" r="70" fill="#a9b7b8"/><path d="M40 400 C50 280 250 280 260 400 Z" fill="#a9b7b8"/></svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer());
}
