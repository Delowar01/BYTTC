import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { saveNotice } from "../../actions";

/** datetime-local value in Asia/Dhaka (UTC+6, no DST). */
function toLocalInput(iso: string | null | undefined) {
  const d = iso ? new Date(iso) : new Date();
  return new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 16);
}

export default async function NoticeFormPage({ params }: PageProps<"/admin/cms/notices/[id]">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("notices").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const fields: FieldDef[] = [
    { name: "title_en", label: "Title (English)", required: true, defaultValue: row?.title_en, wide: true },
    { name: "title_bn", label: "Title (Bangla)", defaultValue: row?.title_bn, wide: true },
    { name: "body_en", label: "Body (English, Markdown)", type: "textarea", rows: 6, defaultValue: row?.body_en },
    { name: "body_bn", label: "Body (Bangla, Markdown)", type: "textarea", rows: 6, defaultValue: row?.body_bn },
    { name: "attachment_url", label: "Attachment (PDF or image)", type: "image", accept: "application/pdf,image/*", defaultValue: row?.attachment_url, wide: true },
    { name: "published_at", label: "Publish date & time (Dhaka time)", type: "datetime-local", defaultValue: toLocalInput(row?.published_at), help: "A future time schedules the notice." },
    { name: "is_pinned", label: "Pinned", type: "checkbox", defaultValue: row?.is_pinned ?? false, placeholder: "Show at the top" },
    { name: "is_published", label: "Published", type: "checkbox", defaultValue: row ? row.is_published : true },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? "New notice" : "Edit notice"} />
      <Card>
        <CardContent>
          <EntityForm action={saveNotice.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/cms/notices" />
        </CardContent>
      </Card>
    </div>
  );
}
