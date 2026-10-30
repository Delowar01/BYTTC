import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { savePage } from "../../actions";

export default async function PageFormPage({ params }: PageProps<"/admin/cms/pages/[id]">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const fields: FieldDef[] = [
    { name: "slug", label: "Slug (URL)", required: true, defaultValue: row?.slug, help: row?.is_system ? "Built-in page: the slug cannot change." : "Custom pages are served at /p/<slug>.", section: "Content" },
    { name: "is_published", label: "Published", type: "checkbox", defaultValue: row ? row.is_published : true },
    { name: "title_en", label: "Title (English)", required: true, defaultValue: row?.title_en },
    { name: "title_bn", label: "Title (Bangla)", defaultValue: row?.title_bn },
    { name: "body_en", label: "Body (English, Markdown: ## heading, - list, **bold**, [link](url))", type: "textarea", rows: 10, defaultValue: row?.body_en },
    { name: "body_bn", label: "Body (Bangla, Markdown)", type: "textarea", rows: 10, defaultValue: row?.body_bn },
    { name: "seo_title_en", label: "SEO title (English)", defaultValue: row?.seo_title_en, section: "Search engines" },
    { name: "seo_title_bn", label: "SEO title (Bangla)", defaultValue: row?.seo_title_bn },
    { name: "seo_description_en", label: "Meta description (English)", type: "textarea", rows: 2, defaultValue: row?.seo_description_en },
    { name: "seo_description_bn", label: "Meta description (Bangla)", type: "textarea", rows: 2, defaultValue: row?.seo_description_bn },
    { name: "og_image_url", label: "Social share image", type: "image", defaultValue: row?.og_image_url, wide: true },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? "New page" : `Edit page: ${row?.title_en}`} />
      <Card>
        <CardContent>
          <EntityForm action={savePage.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/cms/pages" />
        </CardContent>
      </Card>
    </div>
  );
}
