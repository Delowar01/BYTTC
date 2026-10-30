import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CENTRAL } from "@/lib/roles";
import { saveCourse } from "../actions";

export default async function CourseFormPage({ params }: PageProps<"/admin/courses/[id]">) {
  const { supabase } = await requireRole(CENTRAL);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const fields: FieldDef[] = [
    { name: "code", label: "Course code", required: true, defaultValue: row?.code, help: "Short unique code, e.g. COA. Used in import files.", section: "Course" },
    { name: "duration_months", label: "Duration (months)", type: "number", defaultValue: row?.duration_months },
    { name: "title_en", label: "Title (English)", required: true, defaultValue: row?.title_en },
    { name: "title_bn", label: "Title (Bangla)", defaultValue: row?.title_bn },
    { name: "summary_en", label: "Short summary (English)", type: "textarea", rows: 2, defaultValue: row?.summary_en },
    { name: "summary_bn", label: "Short summary (Bangla)", type: "textarea", rows: 2, defaultValue: row?.summary_bn },
    { name: "description_en", label: "Full description (English, Markdown)", type: "textarea", rows: 6, defaultValue: row?.description_en },
    { name: "description_bn", label: "Full description (Bangla, Markdown)", type: "textarea", rows: 6, defaultValue: row?.description_bn },
    { name: "fee", label: "Fee (Tk)", type: "number", step: "0.01", defaultValue: row?.fee, section: "Website" },
    { name: "sort_order", label: "Sort order", type: "number", defaultValue: row?.sort_order ?? 0 },
    { name: "image_url", label: "Image", type: "image", defaultValue: row?.image_url, wide: true },
    { name: "is_published", label: "Show on website", type: "checkbox", defaultValue: row ? row.is_published : true },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? "New course" : `Edit course ${row?.code}`} />
      <Card>
        <CardContent>
          <EntityForm action={saveCourse.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/courses" />
        </CardContent>
      </Card>
    </div>
  );
}
