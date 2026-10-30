"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { dbMessage, fail, formValues, success, zodFail, type FormState } from "@/lib/forms";
import { CMS_EDITORS } from "@/lib/roles";
import { checkbox, optEmail, optInt, optText, optUrl, reqText } from "@/lib/schemas";
import { resolveImageField } from "@/lib/storage";

/** Public pages read CMS data on every request; refresh the whole site layout. */
function refreshSite() {
  revalidatePath("/", "layout");
}

// --- Site settings ---------------------------------------------------------
const settingsSchema = z.object({
  org_name_en: reqText("Organization name (English)", 200),
  org_name_bn: optText,
  short_name: optText,
  org_registration_no: optText,
  tagline_en: optText,
  tagline_bn: optText,
  email: optEmail,
  phone: optText,
  address_en: optText,
  address_bn: optText,
  office_hours_en: optText,
  office_hours_bn: optText,
  map_embed_url: optUrl,
  footer_text_en: optText,
  footer_text_bn: optText,
  disclaimer_en: optText,
  disclaimer_bn: optText,
  facebook_url: optUrl,
  youtube_url: optUrl,
  seo_title_en: optText,
  seo_title_bn: optText,
  seo_description_en: optText,
  seo_description_bn: optText,
  public_show_photo: checkbox,
  public_show_parents: checkbox,
  public_show_dob: checkbox,
  cert_title_en: reqText("Certificate title", 80),
  cert_signatory_left: reqText("Left signatory", 60),
  cert_signatory_right: reqText("Right signatory", 60),
  registration_card_validity_years: optInt(1, 30),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = settingsSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const logo = await resolveImageField(supabase, formData, "logo_url", "branding");
    if (logo.error) return fail(logo.error, values, { logo_url: logo.error });
    const og = await resolveImageField(supabase, formData, "og_image_url", "branding");
    if (og.error) return fail(og.error, values, { og_image_url: og.error });
    const { error } = await supabase.from("site_settings").update({ ...parsed.data, logo_url: logo.url, og_image_url: og.url }).eq("id", 1);
    if (error) return fail(dbMessage(error), values);
    refreshSite();
    return success("Settings saved.");
  });
}

// --- Pages ------------------------------------------------------------------
const pageSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/, "2–60 lowercase letters, digits or dashes"),
  title_en: reqText("Title (English)", 200),
  title_bn: optText,
  body_en: optText,
  body_bn: optText,
  seo_title_en: optText,
  seo_title_bn: optText,
  seo_description_en: optText,
  seo_description_bn: optText,
  is_published: checkbox,
});

export async function savePage(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = pageSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const og = await resolveImageField(supabase, formData, "og_image_url", "pages");
    if (og.error) return fail(og.error, values, { og_image_url: og.error });
    const row = { ...parsed.data, og_image_url: og.url };
    if (id) {
      const { data: existing } = await supabase.from("pages").select("is_system, slug").eq("id", id).maybeSingle();
      if (!existing) return fail("Page not found.", values);
      // Built-in pages keep their slug (it is tied to a route).
      if (existing.is_system) row.slug = existing.slug;
    }
    const { error } = id ? await supabase.from("pages").update(row).eq("id", id) : await supabase.from("pages").insert(row);
    if (error) return fail(dbMessage(error), values);
    refreshSite();
    redirect("/admin/cms/pages?saved=1");
  });
}

export async function deletePage(id: string, _prev: FormState): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const { data, error } = await supabase.from("pages").delete().eq("id", id).eq("is_system", false).select("id");
    if (error) return fail(dbMessage(error));
    if (!data?.length) return fail("Built-in pages cannot be deleted.");
    refreshSite();
    return success("Deleted.");
  });
}

// --- Banners ----------------------------------------------------------------
const bannerSchema = z.object({
  title_en: reqText("Title (English)", 200),
  title_bn: optText,
  subtitle_en: optText,
  subtitle_bn: optText,
  link_url: optUrl,
  link_label_en: optText,
  link_label_bn: optText,
  sort_order: optInt(-10_000, 10_000),
  is_active: checkbox,
});

export async function saveBanner(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = bannerSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const image = await resolveImageField(supabase, formData, "image_url", "banners");
    if (image.error) return fail(image.error, values, { image_url: image.error });
    const row = { ...parsed.data, sort_order: parsed.data.sort_order ?? 0, image_url: image.url };
    const { error } = id ? await supabase.from("banners").update(row).eq("id", id) : await supabase.from("banners").insert(row);
    if (error) return fail(dbMessage(error), values);
    refreshSite();
    redirect("/admin/cms/banners?saved=1");
  });
}

export async function deleteBanner(id: string, _prev: FormState): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return fail(dbMessage(error));
    refreshSite();
    return success("Deleted.");
  });
}

// --- Menus ------------------------------------------------------------------
const menuSchema = z.object({
  location: z.enum(["header", "footer"]),
  label_en: reqText("Label (English)", 100),
  label_bn: optText,
  href: z.string().trim().regex(/^(\/|https?:\/\/)/, "Start with / for site pages or https:// for external links"),
  sort_order: optInt(-10_000, 10_000),
  is_active: checkbox,
});

export async function saveMenuItem(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = menuSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const row = { ...parsed.data, sort_order: parsed.data.sort_order ?? 0 };
    const { error } = id ? await supabase.from("menu_items").update(row).eq("id", id) : await supabase.from("menu_items").insert(row);
    if (error) return fail(dbMessage(error), values);
    refreshSite();
    redirect("/admin/cms/menus?saved=1");
  });
}

export async function deleteMenuItem(id: string, _prev: FormState): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return fail(dbMessage(error));
    refreshSite();
    return success("Deleted.");
  });
}

// --- Notices ----------------------------------------------------------------
const noticeSchema = z.object({
  title_en: reqText("Title (English)", 300),
  title_bn: optText,
  body_en: optText,
  body_bn: optText,
  // The form sends Dhaka local time (UTC+6, no DST); the server runs in UTC.
  published_at: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return new Date().toISOString();
      const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+06:00` : v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
        return z.NEVER;
      }
      return d.toISOString();
    }),
  is_pinned: checkbox,
  is_published: checkbox,
});

export async function saveNotice(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const values = formValues(formData);
    const parsed = noticeSchema.safeParse(values);
    if (!parsed.success) return zodFail(parsed.error, values);
    const attachment = await resolveImageField(supabase, formData, "attachment_url", "notices");
    if (attachment.error) return fail(attachment.error, values, { attachment_url: attachment.error });
    const row = { ...parsed.data, attachment_url: attachment.url };
    const { error } = id ? await supabase.from("notices").update(row).eq("id", id) : await supabase.from("notices").insert(row);
    if (error) return fail(dbMessage(error), values);
    refreshSite();
    redirect("/admin/cms/notices?saved=1");
  });
}

export async function deleteNotice(id: string, _prev: FormState): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) return fail(dbMessage(error));
    refreshSite();
    return success("Deleted.");
  });
}

// --- Media library ----------------------------------------------------------
const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "application/pdf"];

export async function uploadMedia(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return fail("Choose at least one file.");
    for (const file of files) {
      if (!MEDIA_TYPES.includes(file.type)) return fail(`${file.name}: unsupported type (images or PDF only).`);
      if (file.size > 5 * 1024 * 1024) return fail(`${file.name}: larger than 5 MB.`);
      const name = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80);
      const { error } = await supabase.storage.from("public-media").upload(`library/${Date.now()}-${name}`, file, { contentType: file.type });
      if (error) return fail(`${file.name}: ${error.message}`);
    }
    revalidatePath("/admin/cms/media");
    return success(`${files.length} file(s) uploaded.`);
  });
}

export async function deleteMedia(path: string, _prev: FormState): Promise<FormState> {
  return withRole(CMS_EDITORS, async ({ supabase }) => {
    const { error } = await supabase.storage.from("public-media").remove([path]);
    if (error) return fail(error.message);
    revalidatePath("/admin/cms/media");
    return success("Deleted.");
  });
}
