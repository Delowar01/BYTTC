import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { saveBanner } from "../../actions";

export default async function BannerFormPage({ params }: PageProps<"/admin/cms/banners/[id]">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("banners").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const fields: FieldDef[] = [
    { name: "title_en", label: "Title (English)", required: true, defaultValue: row?.title_en },
    { name: "title_bn", label: "Title (Bangla)", defaultValue: row?.title_bn },
    { name: "subtitle_en", label: "Subtitle (English)", type: "textarea", rows: 2, defaultValue: row?.subtitle_en },
    { name: "subtitle_bn", label: "Subtitle (Bangla)", type: "textarea", rows: 2, defaultValue: row?.subtitle_bn },
    { name: "link_url", label: "Button link", defaultValue: row?.link_url, placeholder: "/courses" },
    { name: "sort_order", label: "Sort order", type: "number", defaultValue: row?.sort_order ?? 0 },
    { name: "link_label_en", label: "Button label (English)", defaultValue: row?.link_label_en },
    { name: "link_label_bn", label: "Button label (Bangla)", defaultValue: row?.link_label_bn },
    { name: "image_url", label: "Background image (wide, e.g. 1600×600)", type: "image", defaultValue: row?.image_url, wide: true },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: row ? row.is_active : true },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? "New banner" : "Edit banner"} />
      <Card>
        <CardContent>
          <EntityForm action={saveBanner.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/cms/banners" />
        </CardContent>
      </Card>
    </div>
  );
}
