import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { CENTRAL, PUBLISHERS, SUPER } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { deleteInstitute, saveInstitute, setInstituteStatus } from "../actions";

export default async function InstituteFormPage({ params, searchParams }: PageProps<"/admin/institutes/[id]">) {
  const { supabase, profile } = await requireRole(CENTRAL);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  let row = null;
  let studentCount = 0;
  if (!isNew) {
    const { data } = await supabase.from("institutes").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
    const { count } = await supabase.from("students").select("*", { count: "exact", head: true }).eq("institute_id", id);
    studentCount = count ?? 0;
  }
  const fields: FieldDef[] = [
    { name: "code", label: "Institute code", required: true, defaultValue: row?.code, help: "Unique, e.g. DHK-002. Used in import files." },
    { name: "established_year", label: "Established (year)", type: "number", defaultValue: row?.established_year },
    { name: "name_en", label: "Name (English)", required: true, defaultValue: row?.name_en },
    { name: "name_bn", label: "Name (Bangla)", defaultValue: row?.name_bn },
    { name: "head_name", label: "Head of institute", defaultValue: row?.head_name },
    { name: "district", label: "District", defaultValue: row?.district },
    { name: "email", label: "Email", type: "email", defaultValue: row?.email },
    { name: "phone", label: "Phone", defaultValue: row?.phone },
    { name: "address", label: "Address", type: "textarea", rows: 2, defaultValue: row?.address },
    { name: "remarks", label: "Internal remarks", type: "textarea", rows: 2, defaultValue: row?.remarks },
  ];
  const canApprove = PUBLISHERS.includes(profile.role);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={isNew ? "New institute" : row!.name_en} description={isNew ? "New institutes start as pending until approved." : `Code ${row!.code}`}>
        {!isNew && (
          <Button variant="outline" asChild>
            <Link href={`/admin/students?institute=${id}`}>Students ({studentCount})</Link>
          </Button>
        )}
      </PageHeader>
      {sp.saved && (
        <Alert variant="success">
          <AlertDescription className="text-inherit">Institute saved.</AlertDescription>
        </Alert>
      )}
      {row && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Approval status <StatusBadge status={row.status} />
            </CardTitle>
            <CardDescription>
              {row.approved_at ? `Approved ${formatDateTime(row.approved_at)}. ` : ""}
              {row.remarks ? `Remarks: ${row.remarks}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!canApprove && <p className="text-sm text-muted-foreground">Only central administrators can change approval status.</p>}
            {canApprove && row.status !== "approved" && (
              <ActionButton action={setInstituteStatus.bind(null, row.id, "approved")} label={row.status === "pending" ? "Approve" : "Reinstate"} variant="default" confirm={`Approve ${row.name_en}? It will appear in the public directory.`} />
            )}
            {canApprove && row.status === "pending" && (
              <ActionButton action={setInstituteStatus.bind(null, row.id, "rejected")} label="Reject" variant="destructive" reasonPrompt="Reason for rejection:" />
            )}
            {canApprove && row.status === "approved" && (
              <ActionButton action={setInstituteStatus.bind(null, row.id, "suspended")} label="Suspend" variant="destructive" reasonPrompt="Reason for suspension (institute users lose access):" />
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <EntityForm action={saveInstitute.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/institutes" />
        </CardContent>
      </Card>
      {row && SUPER.includes(profile.role) && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>Institutes with students cannot be deleted; suspend them instead.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionButton action={deleteInstitute.bind(null, row.id)} label="Delete institute" variant="destructive" confirm={`Permanently delete ${row.name_en}?`} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
