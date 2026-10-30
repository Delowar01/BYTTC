import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS, USER_MANAGERS, type AppRole } from "@/lib/roles";
import { createUser, updateUser } from "../actions";

export default async function UserFormPage({ params }: PageProps<"/admin/users/[id]">) {
  const { supabase, profile } = await requireRole(USER_MANAGERS);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const assignable: AppRole[] =
    profile.role === "super_admin" ? (Object.keys(ROLE_LABELS) as AppRole[]) : profile.role === "central_admin" ? ["institute_admin", "institute_staff"] : ["institute_staff"];
  const { data: institutes } = await supabase.from("institutes").select("id, code, name_en").eq("status", "approved").order("code");
  const tenant = profile.role === "institute_admin";
  const fields: FieldDef[] = [
    ...(isNew ? [{ name: "email", label: "Email", type: "email" as const, required: true }] : []),
    { name: "full_name", label: "Full name", required: true, defaultValue: row?.full_name },
    ...(tenant
      ? []
      : [
          { name: "role", label: "Role", type: "select" as const, required: true, defaultValue: row?.role ?? assignable[0], options: assignable.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          { name: "institute_id", label: "Institute (institute roles only)", type: "select" as const, defaultValue: row?.institute_id, options: (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name_en}` })) },
        ]),
    { name: "password", label: isNew ? "Temporary password" : "Set new password (optional)", type: "password", required: isNew, help: "Min 10 characters with upper, lower case and a digit. Share it securely; the user should change it under My account." },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: row ? row.is_active : true },
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title={isNew ? (tenant ? "New staff account" : "New user") : `Edit ${row?.email}`} />
      <Card>
        <CardContent>
          <EntityForm action={isNew ? createUser : updateUser.bind(null, id)} fields={fields} cancelHref="/admin/users" />
        </CardContent>
      </Card>
    </div>
  );
}
