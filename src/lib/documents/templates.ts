import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPrivate } from "./assets";
import { DEFAULT_LAYOUTS } from "./default-layouts";
import type { DocType, Layout, RenderPage } from "./types";

export const TEMPLATE_BUCKET = "document-templates";

export type ResolvedTemplate = { templateId: string | null; version: number | null; layout: Layout; background: RenderPage["background"]; assets: Record<string, Uint8Array> };
export type TemplateSource = { layout: unknown; background_path: string | null; background_type: string | null };

const BACKGROUND_TYPES = ["png", "jpeg", "pdf"] as const;
const isBackgroundType = (t: string | null): t is (typeof BACKGROUND_TYPES)[number] => BACKGROUND_TYPES.includes(t as never);

/**
 * Resolves template snapshots (layout + background + signature assets) with
 * per-request caching, so bulk PDFs download and embed each file once.
 */
export function templateLoader(storage: SupabaseClient) {
  const files = new Map<string, Promise<Uint8Array | null>>();
  const file = (path: string | null | undefined) => {
    if (!path) return Promise.resolve(null);
    let p = files.get(path);
    if (!p) {
      p = loadPrivate(storage, TEMPLATE_BUCKET, path);
      files.set(path, p);
    }
    return p;
  };
  return async (src: TemplateSource) => {
    const layout = src.layout as Layout;
    const assetPaths = [...new Set(layout.fields.flatMap((f) => (f.kind === "image" && f.source === "asset" && f.asset ? [f.asset] : [])))];
    const [bg, ...assetBytes] = await Promise.all([file(src.background_path), ...assetPaths.map(file)]);
    const assets: Record<string, Uint8Array> = {};
    assetPaths.forEach((p, i) => {
      if (assetBytes[i]) assets[p] = assetBytes[i]!;
    });
    return { layout, background: bg && isBackgroundType(src.background_type) ? { bytes: bg, type: src.background_type } : null, assets };
  };
}

/** The active template for a document type (built-in layout when none is active). */
export async function activeTemplate(client: SupabaseClient, type: DocType, storage: SupabaseClient = client): Promise<ResolvedTemplate> {
  const { data } = await client
    .from("document_templates")
    .select("id, version, layout, background_path, background_type")
    .eq("doc_type", type)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { templateId: null, version: null, layout: DEFAULT_LAYOUTS[type], background: null, assets: {} };
  return { templateId: data.id, version: data.version, ...(await templateLoader(storage)(data)) };
}
