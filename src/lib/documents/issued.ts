import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { loadLogo, loadPrivate } from "./assets";
import { SETTINGS_COLUMNS } from "./data";
import { renderDocumentPdf } from "./render";
import { templateLoader, type TemplateSource } from "./templates";
import type { DocData, MarksRow, RenderPage } from "./types";

/** An issued document (admit/registration card or templated certificate) with its stored snapshot. */
export type IssuedItem = TemplateSource & { number: string; data: unknown; overlay?: string };

export const verifyUrl = (no: string) => `${env.siteUrl.replace(/\/$/, "")}/verify?no=${encodeURIComponent(no)}`;

/** Snapshot JSON → template data (all strings). */
export function snapshotData(data: unknown): DocData {
  const out: DocData = {};
  for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) {
    out[k] = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return out;
}

/** Marks row from a certificate snapshot (keys written by result_document_data). */
function snapshotMarks(d: DocData): MarksRow | undefined {
  if (!d.total_marks) return undefined;
  return { theory: d.m_theory ?? "", practical: d.m_practical ?? "", viva: d.m_viva ?? "", total: d.total_marks, full: d.full_marks ?? "", grade: d.grade ?? "", point: d.grade_point ? Number(d.grade_point).toFixed(2) : "" };
}

/**
 * Render issued documents from their snapshots. Photos and template files are
 * read with `storage` (the signed-in staff client, so RLS applies).
 */
export async function renderIssued(client: SupabaseClient, storage: SupabaseClient, items: IssuedItem[], title: string) {
  const { data: settings } = await client.from("site_settings").select(SETTINGS_COLUMNS).eq("id", 1).single();
  const s = settings as unknown as { org_name_en: string; logo_url: string | null };
  const load = templateLoader(storage);
  const pages: RenderPage[] = [];
  for (const item of items) {
    const template = await load(item);
    const data = snapshotData(item.data);
    if (data.grade_point && /^\d+(\.\d+)?$/.test(data.grade_point)) data.grade_point = Number(data.grade_point).toFixed(2);
    pages.push({
      ...template,
      data: { ...data, verify_url: verifyUrl(item.number) },
      marks: snapshotMarks(data),
      photo: await loadPrivate(storage, "private-documents", data.photo_path),
      overlay: item.overlay,
    });
  }
  return renderDocumentPdf(pages, { title, author: s.org_name_en, logo: await loadLogo(s.logo_url) });
}
