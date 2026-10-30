import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { ActionButton } from "@/components/admin/action-button";
import { CheckboxGroupForm } from "@/components/admin/checkbox-group-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { CENTRAL, PUBLISHERS, ROLE_LABELS, SUPER } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { createUser } from "@/app/admin/users/actions";
import { deleteInstitute, saveCourseAssignments, saveInstitute, setInstituteStatus } from "../actions";

export default async function InstituteFormPage({ params, searchParams }: PageProps<"/admin/institutes/[id]">) {
  const { supabase, profile } = await requireRole(CENTRAL);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  let row = null;
  let studentCount = 0;
  let accounts: { id: string; email: string | null; full_name: string | null; role: keyof typeof ROLE_LABELS; is_active: boolean }[] = [];
  let assigned = new Set<string>();
  if (!isNew) {
    const { data } = await supabase.from("institutes").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
    const [{ count }, { data: profiles }, { data: ic }] = await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }).eq("institute_id", id),
      supabase.from("profiles").select("id, email, full_name, role, is_active").eq("institute_id", id).order("role"),
      supabase.from("institute_courses").select("course_id").eq("institute_id", id),
    ]);
    studentCount = count ?? 0;
    accounts = profiles ?? [];
    assigned = new Set((ic ?? []).map((c) => c.course_id));
  }
  const { data: allCourses } = await supabase.from("courses").select("id, code, title_en").order("code");
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
      {sp.account && (
        <Alert variant="success">
          <AlertDescription className="text-inherit">Account created. Share the temporary password securely.</AlertDescription>
        </Alert>
      )}
      {row?.applied_at && (
        <Card>
          <CardHeader>
            <CardTitle>Online application</CardTitle>
            <CardDescription>Submitted {formatDateTime(row.applied_at)}. Assign a permanent institute code below before approving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Contact person:</span> {row.applicant_name} · {row.applicant_phone} · {row.applicant_email}
            </p>
            {row.requested_courses.length > 0 && (
              <p>
                <span className="text-muted-foreground">Requested courses:</span> {row.requested_courses.join(", ")}
              </p>
            )}
            {row.application_note && <p className="whitespace-pre-line">{row.application_note}</p>}
            {row.documents.length > 0 && (
              <ul className="list-disc pl-5">
                {row.documents.map((d) => (
                  <li key={d}>
                    <a className="text-primary hover:underline" href={`/admin/institutes/${row!.id}/document?path=${encodeURIComponent(d)}`} target="_blank">
                      {d.split("/").pop()}
                    </a>{" "}
                    <span className="text-xs text-muted-foreground">(private, link valid 60 s)</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>Course assignments</CardTitle>
            <CardDescription>The institute can only register students in assigned courses.</CardDescription>
          </CardHeader>
          <CardContent>
            <CheckboxGroupForm
              action={saveCourseAssignments.bind(null, row.id)}
              name="courses"
              disabled={!canApprove}
              submitLabel="Save assignments"
              options={(allCourses ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title_en}`, checked: assigned.has(c.id), hint: row.requested_courses.includes(c.code) && !assigned.has(c.id) ? "requested" : undefined }))}
            />
          </CardContent>
        </Card>
      )}
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>Institute accounts</CardTitle>
            <CardDescription>
              {row.status === "approved" ? "Activate the institute by creating its administrator account. The institute admin can then add staff." : "Accounts can be created once the institute is approved."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {accounts.length > 0 && (
              <ul className="space-y-1 text-sm">
                {accounts.map((a) => (
                  <li key={a.id}>
                    {a.full_name} · {a.email} · {ROLE_LABELS[a.role]} {!a.is_active && <StatusBadge status="inactive" />}
                  </li>
                ))}
              </ul>
            )}
            {row.status === "approved" && canApprove && (
              <EntityForm
                action={createUser}
                submitLabel="Create account"
                hidden={{ institute_id: row.id, back: `/admin/institutes/${row.id}`, is_active: "on" }}
                fields={[
                  { name: "full_name", label: "Full name", required: true, defaultValue: accounts.length ? "" : row.applicant_name },
                  { name: "email", label: "Email", type: "email", required: true, defaultValue: accounts.length ? "" : row.applicant_email },
                  { name: "role", label: "Role", type: "select", required: true, defaultValue: accounts.some((a) => a.role === "institute_admin") ? "institute_staff" : "institute_admin", options: [{ value: "institute_admin", label: "Institute Admin" }, { value: "institute_staff", label: "Institute Staff" }] },
                  { name: "password", label: "Temporary password", type: "password", required: true, help: "Min 10 chars, upper + lower case + digit. The user should change it under My account." },
                ]}
              />
            )}
          </CardContent>
        </Card>
      )}
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
