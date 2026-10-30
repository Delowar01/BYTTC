import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { saveSettings } from "../actions";

export const metadata = { title: "Site settings" };

export default async function SettingsPage() {
  const { supabase } = await requireRole(CMS_EDITORS);
  const { data: s } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  const f = (name: keyof NonNullable<typeof s>, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, defaultValue: s?.[name] as string | null, ...extra });
  const fields: FieldDef[] = [
    f("org_name_en", "Issuing organization name (English)", { required: true, section: "Identity", help: "Legal name of the organization that issues results and certificates." }),
    f("org_name_bn", "Organization name (Bangla)"),
    f("short_name", "Short name / abbreviation"),
    f("org_registration_no", "Organization registration number", { help: "e.g. company/trust registration. Shown on result sheets and documents." }),
    f("logo_url", "Logo", { type: "image" }),
    f("tagline_en", "Tagline (English)"),
    f("tagline_bn", "Tagline (Bangla)"),
    f("email", "Email", { type: "email", section: "Contact" }),
    f("phone", "Phone"),
    f("address_en", "Address (English)", { type: "textarea", rows: 2 }),
    f("address_bn", "Address (Bangla)", { type: "textarea", rows: 2 }),
    f("office_hours_en", "Office hours (English)"),
    f("office_hours_bn", "Office hours (Bangla)"),
    f("map_embed_url", "Google Maps embed URL", { wide: true, help: "Optional: https://www.google.com/maps/embed?…" }),
    f("facebook_url", "Facebook page URL"),
    f("youtube_url", "YouTube channel URL"),
    f("footer_text_en", "Footer text (English)", { type: "textarea", rows: 2, section: "Footer & disclaimer" }),
    f("footer_text_bn", "Footer text (Bangla)", { type: "textarea", rows: 2 }),
    f("disclaimer_en", "Accreditation disclaimer (English)", { type: "textarea", rows: 3, help: "State clearly who issues credentials. Do not claim government accreditation unless authorized." }),
    f("disclaimer_bn", "Accreditation disclaimer (Bangla)", { type: "textarea", rows: 3 }),
    f("seo_title_en", "Default SEO title (English)", { section: "Search engines (default SEO)" }),
    f("seo_title_bn", "Default SEO title (Bangla)"),
    f("seo_description_en", "Default meta description (English)", { type: "textarea", rows: 2 }),
    f("seo_description_bn", "Default meta description (Bangla)", { type: "textarea", rows: 2 }),
    f("og_image_url", "Social share image", { type: "image", wide: true }),
    f("cert_title_en", "Certificate title", { required: true, section: "Certificates", help: "Printed on PDF certificates with the organization name, logo and disclaimer above." }),
    f("cert_signatory_left", "Left signature label", { required: true }),
    f("cert_signatory_right", "Right signature label", { required: true }),
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Site settings" description="Organization identity, contact details, footer and default SEO for the public website." />
      <Card>
        <CardContent>
          <EntityForm action={saveSettings} fields={fields} />
        </CardContent>
      </Card>
    </div>
  );
}
