import { z } from "zod";
import type { Layout } from "./types";

/**
 * Validation of layouts saved from the template editor. Positions are page
 * percentages; asset paths must point into the template bucket's assets folder.
 */
const pos = z.number().min(0).max(100);
const dim = z.number().min(0.3).max(100);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be #RRGGBB");
const base = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  x: pos,
  y: pos,
  hidden: z.boolean().optional(),
};

export const ASSET_PATH = /^assets\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/;

const field = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("text"),
    text: z.string().max(400),
    w: dim,
    size: z.number().min(4).max(96),
    font: z.enum(["sans", "serif"]).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    color: color.optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    wrap: z.boolean().optional(),
    lineHeight: z.number().min(0.8).max(3).optional(),
    bg: color.optional(),
    hideIfEmpty: z.boolean().optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("image"),
    source: z.enum(["photo", "logo", "asset"]),
    asset: z.string().regex(ASSET_PATH).optional(),
    w: dim,
    h: dim,
    border: z.boolean().optional(),
    opacity: z.number().min(0.05).max(1).optional(),
  }),
  z.object({ ...base, kind: z.literal("qr"), w: z.number().min(4).max(40) }),
  z.object({ ...base, kind: z.literal("line"), w: dim, thickness: z.number().min(0.2).max(6).optional(), color: color.optional() }),
  z.object({ ...base, kind: z.literal("box"), w: dim, h: dim, color: color.optional(), fill: color.optional(), thickness: z.number().min(0.2).max(6).optional() }),
  z.object({ ...base, kind: z.literal("marks_table"), w: z.number().min(20).max(100), size: z.number().min(5).max(16), color: color.optional(), headerBg: color.optional() }),
]);

export const layoutSchema = z
  .object({
    orientation: z.enum(["portrait", "landscape"]),
    frame: z.enum(["classic", "none"]),
    accent: color.optional(),
    watermark: z.boolean().optional(),
    fields: z.array(field).max(200),
  })
  .superRefine((layout, ctx) => {
    const ids = new Set<string>();
    for (const f of layout.fields) {
      if (ids.has(f.id)) ctx.addIssue({ code: "custom", message: `Duplicate field id ${f.id}` });
      ids.add(f.id);
      if (f.kind === "image" && f.source === "asset" && !f.asset) ctx.addIssue({ code: "custom", message: "An uploaded-image field has no image" });
    }
  });

export function parseLayout(json: unknown): { ok: true; layout: Layout } | { ok: false; error: string } {
  let value = json;
  if (typeof json === "string") {
    try {
      value = JSON.parse(json);
    } catch {
      return { ok: false, error: "The layout is not valid JSON." };
    }
  }
  const parsed = layoutSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Invalid layout: ${issue.path.join(".") || "layout"} — ${issue.message}` };
  }
  return { ok: true, layout: parsed.data as Layout };
}
