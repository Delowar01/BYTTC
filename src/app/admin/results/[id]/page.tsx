import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { issueForResult } from "@/app/admin/certificates/actions";
import { correctResult, deleteResult } from "../actions";

export default async function ResultPage({ params }: PageProps<"/admin/results/[id]">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const { id } = await params;
  const { data: r } = await supabase
    .from("results")
    .select("*, students(roll_no, registration_no, name_en), exams(code, name, theory_full_marks, practical_full_marks, pass_marks), institutes(code, name_en)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const canPublish = PUBLISHERS.includes(profile.role);
  const live = r.status === "published" || r.status === "unpublished";
  const editable = !live || canPublish;
  const { data: certs } = await supabase.from("certificates").select("id, certificate_no, status, issued_at").eq("result_id", id).order("issued_at", { ascending: false });
  const validCert = certs?.find((c) => c.status === "valid");
  const { data: history } = canPublish
    ? await supabase.from("audit_logs").select("id, occurred_at, action, actor_id, old_data, new_data, reason").eq("table_name", "results").eq("record_id", id).order("occurred_at", { ascending: false }).limit(50)
    : { data: [] };

  const fields: FieldDef[] = [
    { name: "theory_marks", label: `Theory marks (of ${Number(r.exams?.theory_full_marks)})`, type: "number", step: "0.01", defaultValue: r.theory_marks },
    { name: "practical_marks", label: `Practical marks (of ${Number(r.exams?.practical_full_marks)})`, type: "number", step: "0.01", defaultValue: r.practical_marks },
    { name: "remarks", label: "Remarks", type: "textarea", rows: 2, defaultValue: r.remarks },
    ...(live ? [{ name: "reason", label: "Reason for correction (required, recorded in audit log)", type: "textarea" as const, rows: 2, required: true }] : []),
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={`${r.students?.name_en} — ${r.exams?.code}`} description={`Roll ${r.students?.roll_no} · Registration ${r.students?.registration_no} · ${r.institutes?.name_en}`} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current result <StatusBadge status={r.status} /> <span className="text-sm font-normal text-muted-foreground">version {r.version}</span>
          </CardTitle>
          <CardDescription>
            Total {r.total_marks} ({r.percentage}%) · Grade {r.grade} ({Number(r.grade_point).toFixed(2)}) · {r.is_pass ? "Pass" : "Fail"} · pass mark {Number(r.exams?.pass_marks)}
            {r.published_at && ` · published ${formatDateTime(r.published_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editable ? (
            <EntityForm action={correctResult.bind(null, id)} fields={fields} submitLabel={live ? "Save correction" : "Save"} cancelHref="/admin/results" />
          ) : (
            <p className="text-sm text-muted-foreground">This result is published. Only central administrators can correct it.</p>
          )}
          {!live && (
            <div className="mt-6">
              <ActionButton action={deleteResult.bind(null, id)} label="Delete draft result" variant="destructive" confirm="Delete this draft result?" />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Certificate</CardTitle>
          <CardDescription>
            {validCert
              ? "Correcting this result does not change the issued certificate. Reissue it from Certificates after a correction."
              : r.status === "published" && r.is_pass
                ? "This result is eligible for a certificate."
                : "Certificates are issued for published, passing results."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {certs?.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono">{c.certificate_no}</span>
              <StatusBadge status={c.status} />
              <span className="text-muted-foreground">{formatDateTime(c.issued_at)}</span>
              <a className="text-primary hover:underline" href={`/admin/certificates/${c.id}/pdf`} target="_blank" rel="noopener">
                PDF
              </a>
            </div>
          ))}
          {canPublish && !validCert && r.status === "published" && r.is_pass && <ActionButton action={issueForResult.bind(null, id)} label="Issue certificate" variant="default" />}
        </CardContent>
      </Card>
      {canPublish && (
        <Card>
          <CardHeader>
            <CardTitle>Change history</CardTitle>
            <CardDescription>Every change to this result, from the audit trail.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history?.length && <EmptyRow colSpan={4} />}
                {history?.map((h) => {
                  const o = (h.old_data ?? {}) as Record<string, unknown>;
                  const n = (h.new_data ?? {}) as Record<string, unknown>;
                  const changed = ["theory_marks", "practical_marks", "status", "grade"].filter((k) => h.action === "UPDATE" && o[k] !== n[k]);
                  return (
                    <TableRow key={h.id}>
                      <TableCell>{formatDateTime(h.occurred_at)}</TableCell>
                      <TableCell>{h.action}</TableCell>
                      <TableCell className="whitespace-normal text-xs">
                        {h.action === "INSERT" ? `created (${n.theory_marks} + ${n.practical_marks})` : changed.map((k) => `${k}: ${o[k]} → ${n[k]}`).join("; ")}
                      </TableCell>
                      <TableCell className="whitespace-normal">{h.reason ?? ""}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
