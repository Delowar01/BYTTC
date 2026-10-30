import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LAYOUTS } from "./default-layouts";
import type { DocType, Layout, RenderPage } from "./types";

export type ResolvedTemplate = { templateId: string | null; version: number | null; layout: Layout; background: RenderPage["background"]; assets: Record<string, Uint8Array> };

/** The active template for a document type (built-in layout until templates are configured). */
export async function activeTemplate(_client: SupabaseClient, type: DocType): Promise<ResolvedTemplate> {
  return { templateId: null, version: null, layout: DEFAULT_LAYOUTS[type], background: null, assets: {} };
}
