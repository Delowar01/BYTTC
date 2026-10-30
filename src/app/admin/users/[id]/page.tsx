import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS, SUPER, type AppRole } from "@/lib/roles";
import { createUser, updateUser } from "../actions";

export default async function UserFormPage({ params }: PageProps<"/admin/users/[id]">) {
  const { supabase } = await requireRole(SUPER);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const { data: institutes } = await supabase.from("institutes").select("id, code, name_en").eq("status", "approved").order("code");
  const fields: FieldDef[] = [
    ...(isNew ? [{ name: "email", label: "Email", type: "email" as const, required: true }] : []),
    { name: "full_name", label: "Full name", required: true, defaultValue: row?.full_name },
    { name: "role", label: "Role", type: "select", required: true, defaultValue: row?.role, options: (Object.keys(ROLE_LABELS) as AppRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
    { name: "institute_id", label: "Institute (institute roles only)", type: "select", defaultValue: row?.institute_id, options: (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name_en}` })) },
    { name: "password", label: isNew ? "Temporary password" : "Set new password (optional)", type: "password", required: isNew, help: "Min 10 characters with upper, lower case and a digit. Share it securely; the user should change it." },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: row ? row.is_active : true },
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title={isNew ? "New user" : `Edit ${row?.email}`} />
      <Card>
        <CardContent>
          <EntityForm action={isNew ? createUser : updateUser.bind(null, id)} fields={fields} cancelHref="/admin/users" />
        </CardContent>
      </Card>
    </div>
  );
}
