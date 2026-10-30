import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CENTRAL } from "@/lib/roles";
import { saveSession } from "../actions";

export default async function SessionFormPage({ params }: PageProps<"/admin/sessions/[id]">) {
  const { supabase } = await requireRole(CENTRAL);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("academic_sessions").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const fields: FieldDef[] = [
    { name: "name", label: "Name", required: true, defaultValue: row?.name, placeholder: "January–June 2027", wide: true },
    { name: "start_date", label: "Start date", type: "date", defaultValue: row?.start_date },
    { name: "end_date", label: "End date", type: "date", defaultValue: row?.end_date },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: row ? row.is_active : true },
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title={isNew ? "New session" : `Edit session`} />
      <Card>
        <CardContent>
          <EntityForm action={saveSession.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/sessions" />
        </CardContent>
      </Card>
    </div>
  );
}
