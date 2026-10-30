"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { DEFAULT_LAYOUTS } from "@/lib/documents/default-layouts";
import { parseLayout } from "@/lib/documents/schema";
import { TEMPLATE_BUCKET } from "@/lib/documents/templates";
import type { DocType, Field } from "@/lib/documents/types";
import { normalizeAsset, normalizeBackground } from "@/lib/documents/uploads";
import { dbMessage, fail, success, type FormState } from "@/lib/forms";
import { PUBLISHERS } from "@/lib/roles";

const docType = z.enum(["certificate", "marksheet", "admit_card", "registration_card"]);
const name = z.string().trim().min(2, "Name: at least 2 characters").max(120);

function refresh(id?: string) {
  revalidatePath("/admin/templates");
  if (id) revalidatePath(`/admin/templates/${id}`);
}

export async function createTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  let created = "";
  const state = await withRole(PUBLISHERS, async ({ supabase }) => {
    const type = docType.safeParse(formData.get("doc_type"));
    const n = name.safeParse(formData.get("name"));
    if (!type.success) return fail("Select a document type.");
    if (!n.success) return fail(n.error.issues[0].message);
    const { data, error } = await supabase
      .from("document_templates")
      .insert({ doc_type: type.data, name: n.data, layout: DEFAULT_LAYOUTS[type.data as DocType] })
      .select("id")
      .single();
    if (error) return fail(dbMessage(error));
    created = data.id;
    refresh();
    return success("Template created.");
  });
  if (created) redirect(`/admin/templates/${created}`);
  return state;
}

/** New draft version in the same family (same design, editable). */
export async function duplicateTemplate(id: string, _prev: FormState): Promise<FormState> {
  let created = "";
  const state = await withRole(PUBLISHERS, async ({ supabase }) => {
    const { data: t } = await supabase.from("document_templates").select("doc_type, name, family_id, layout, background_path, background_type").eq("id", id).single();
    if (!t) return fail("Template not found.");
    const { data: latest } = await supabase.from("document_templates").select("version").eq("family_id", t.family_id).order("version", { ascending: false }).limit(1).single();
    const { data, error } = await supabase
      .from("document_templates")
      .insert({ ...t, version: (latest?.version ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return fail(dbMessage(error));
    created = data.id;
    refresh();
    return success("New draft version created.");
  });
  if (created) redirect(`/admin/templates/${created}`);
  return state;
}

export async function activateTemplate(id: string, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { data: t } = await supabase.from("document_templates").select("layout, status").eq("id", id).single();
    if (!t) return fail("Template not found.");
    const parsed = parseLayout(t.layout);
    if (!parsed.ok) return fail(parsed.error);
    const { error } = await supabase.rpc("activate_document_template", { p_id: id });
    if (error) return fail(error.message);
    refresh(id);
    return success("Template activated. New documents of this type now use it; issued documents keep their original design.");
  });
}

export async function archiveTemplate(id: string, _prev: FormState): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const { error } = await supabase.from("document_templates").update({ status: "archived" }).eq("id", id);
    if (error) return fail(dbMessage(error));
    refresh(id);
    return success("Template archived.");
  });
}

export async function deleteTemplate(id: string, _prev: FormState): Promise<FormState> {
  let deleted = false;
  const state = await withRole(PUBLISHERS, async ({ supabase }) => {
    const { error, count } = await supabase.from("document_templates").delete({ count: "exact" }).eq("id", id);
    if (error) return fail(dbMessage(error));
    if (!count) return fail("Template not found.");
    deleted = true;
    refresh();
    return success("Draft deleted.");
  });
  if (deleted) redirect("/admin/templates");
  return state;
}

/** Save the editor state (name + layout). Only drafts are editable (enforced in the database too). */
export async function saveTemplate(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const n = name.safeParse(formData.get("name"));
    if (!n.success) return fail(n.error.issues[0].message);
    const parsed = parseLayout(String(formData.get("layout") ?? ""));
    if (!parsed.ok) return fail(parsed.error);
    const { error } = await supabase.from("document_templates").update({ name: n.data, layout: parsed.layout }).eq("id", id);
    if (error) return fail(dbMessage(error));
    refresh(id);
    return success("Template saved.");
  });
}

/** Upload a blank design (PNG/JPG/PDF); saves the editor's current layout with it. */
export async function uploadBackground(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Choose a design file.");
    const parsed = parseLayout(String(formData.get("layout") ?? ""));
    if (!parsed.ok) return fail(parsed.error);
    const bg = await normalizeBackground(file);
    if ("error" in bg) return fail(bg.error);
    const path = `backgrounds/${id}/${Date.now()}.${bg.type === "jpeg" ? "jpg" : bg.type}`;
    const { error: upErr } = await supabase.storage.from(TEMPLATE_BUCKET).upload(path, bg.bytes, { contentType: bg.contentType });
    if (upErr) return fail(upErr.message);
    const layout = { ...parsed.layout, orientation: bg.orientation, frame: "none" as const };
    const { error } = await supabase.from("document_templates").update({ layout, background_path: path, background_type: bg.type }).eq("id", id);
    if (error) return fail(dbMessage(error));
    refresh(id);
    return success(`Design uploaded (${bg.orientation}). Place the fields on it and save.`);
  });
}

export async function removeBackground(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const parsed = parseLayout(String(formData.get("layout") ?? ""));
    if (!parsed.ok) return fail(parsed.error);
    const { error } = await supabase.from("document_templates").update({ layout: parsed.layout, background_path: null, background_type: null }).eq("id", id);
    if (error) return fail(dbMessage(error));
    refresh(id);
    return success("Design removed; the built-in frame option is available again.");
  });
}

/** Upload a signature/stamp image and add it to the layout as an image field. */
export async function uploadAsset(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Choose an image.");
    const parsed = parseLayout(String(formData.get("layout") ?? ""));
    if (!parsed.ok) return fail(parsed.error);
    const asset = await normalizeAsset(file);
    if ("error" in asset) return fail(asset.error);
    const path = `assets/${id}/${Date.now()}.png`;
    const { error: upErr } = await supabase.storage.from(TEMPLATE_BUCKET).upload(path, asset.bytes, { contentType: "image/png" });
    if (upErr) return fail(upErr.message);
    const field: Field = { id: `asset-${Date.now().toString(36)}`, kind: "image", source: "asset", asset: path, x: 40, y: 80, w: 18, h: 6 };
    const layout = { ...parsed.layout, fields: [...parsed.layout.fields, field] };
    const { error } = await supabase.from("document_templates").update({ layout }).eq("id", id);
    if (error) return fail(dbMessage(error));
    refresh(id);
    return success("Image added to the layout. Drag it into place and save.");
  });
}
