import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { saveMenuItem } from "../../actions";

export default async function MenuFormPage({ params }: PageProps<"/admin/cms/menus/[id]">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("menu_items").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const fields: FieldDef[] = [
    { name: "location", label: "Location", type: "select", required: true, defaultValue: row?.location ?? "header", options: [{ value: "header", label: "Header" }, { value: "footer", label: "Footer" }] },
    { name: "sort_order", label: "Sort order", type: "number", defaultValue: row?.sort_order ?? 0 },
    { name: "label_en", label: "Label (English)", required: true, defaultValue: row?.label_en },
    { name: "label_bn", label: "Label (Bangla)", defaultValue: row?.label_bn },
    { name: "href", label: "Link", required: true, defaultValue: row?.href, placeholder: "/about or https://…", wide: true },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: row ? row.is_active : true },
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title={isNew ? "New menu item" : "Edit menu item"} />
      <Card>
        <CardContent>
          <EntityForm action={saveMenuItem.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/cms/menus" />
        </CardContent>
      </Card>
    </div>
  );
}
