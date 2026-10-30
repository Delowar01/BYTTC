import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { correctResult, deleteResult, setResultPublication } from "../actions";

export default async function ResultPage({ params, searchParams }: PageProps<"/admin/results/[id]">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const { id } = await params;
  const { created } = await searchParams;
  const { data: r } = await supabase
    .from("results")
    .select("*, students(roll_no, registration_no, name_en), exams(code, name, theory_full_marks, practical_full_marks, viva_full_marks, pass_marks), institutes(code, name_en), grade_scales(code, version, name, max_point)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const canPublish = PUBLISHERS.includes(profile.role);
  const live = r.status === "published" || r.status === "unpublished";
  const editable = !live || canPublish;
  const { data: certs } = await supabase.from("certificates").select("id, certificate_no, status, issued_at, needs_reissue").eq("result_id", id).order("issued_at", { ascending: false });
  const validCert = certs?.find((c) => c.status === "valid");
  const { data: history } = canPublish
    ? await supabase.from("audit_logs").select("id, occurred_at, action, actor_id, old_data, new_data, reason").eq("table_name", "results").eq("record_id", id).order("occurred_at", { ascending: false }).limit(50)
    : { data: [] };

  const vivaFull = Number(r.exams?.viva_full_marks ?? 0);
  const fields: FieldDef[] = [
    { name: "theory_marks", label: `Written/theory marks (of ${Number(r.exams?.theory_full_marks)})`, type: "number", step: "0.01", defaultValue: r.theory_marks },
    { name: "practical_marks", label: `Practical marks (of ${Number(r.exams?.practical_full_marks)})`, type: "number", step: "0.01", defaultValue: r.practical_marks },
    ...(vivaFull > 0 || r.viva_marks !== null ? [{ name: "viva_marks", label: `Viva marks (of ${vivaFull})`, type: "number" as const, step: "0.01", defaultValue: r.viva_marks }] : []),
    { name: "remarks", label: "Remarks", type: "textarea", rows: 2, defaultValue: r.remarks },
    ...(canPublish
      ? [
          { name: "display_published_on", label: "Displayed publication date", type: "date" as const, defaultValue: r.display_published_on, help: "Printed on results and documents. The actual publication time is recorded separately and never changes.", section: "Publication & grade (central administrators)" },
          { name: "grade_override", label: "Grade override (optional)", defaultValue: r.grade_override, help: "Leave blank to use the grading scale. Overrides are flagged in the record and require a reason." },
          { name: "grade_point_override", label: "Grade point override (optional)", type: "number" as const, step: "0.01", defaultValue: r.grade_point_override },
        ]
      : []),
    { name: "reason", label: live ? "Reason for correction (required, recorded in audit log)" : "Reason (required for grade overrides)", type: "textarea", rows: 2, required: live, section: canPublish ? undefined : "Reason" },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={`${r.students?.name_en} — ${r.exams?.code}`} description={`Roll ${r.students?.roll_no} · Registration ${r.students?.registration_no} · ${r.institutes?.name_en}`}>
        {canPublish && (r.status === "draft" || r.status === "submitted" || r.status === "unpublished") && (
          <ActionButton action={setResultPublication.bind(null, id, true)} label="Publish result" variant="default" size="default" confirm="Publish this result? It becomes visible in public result search." />
        )}
        {canPublish && r.status === "published" && (
          <ActionButton action={setResultPublication.bind(null, id, false)} label="Unpublish" size="default" confirm="Hide this result from public search?" />
        )}
      </PageHeader>
      {created && (
        <Alert variant="success">
          <AlertDescription className="text-inherit">Result saved as draft. {canPublish ? "Review it, then publish." : "Submit it for central review from Marks entry."}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current result <StatusBadge status={r.status} /> <span className="text-sm font-normal text-muted-foreground">version {r.version}</span>
          </CardTitle>
          <CardDescription className="space-y-1">
            <span className="block" data-testid="result-summary">
              Written {r.theory_marks ?? "—"} · Practical {r.practical_marks ?? "—"} · Viva {vivaFull > 0 ? (r.viva_marks ?? "—") : "N/A"} · Total {Number(r.total_marks)} / {Number(r.full_marks)} ({r.percentage}%) · Grade {r.grade} ({Number(r.grade_point).toFixed(2)}
              {r.grade_scales ? ` of ${Number(r.grade_scales.max_point).toFixed(2)}` : ""}) · {r.is_pass ? "Pass" : "Fail"} · pass mark {Number(r.exams?.pass_marks)}
              {r.grade_override && <Badge variant="warning" className="ml-2">grade override</Badge>}
            </span>
            <span className="block text-xs">
              Scale: {r.grade_scales ? `${r.grade_scales.name} (${r.grade_scales.code} v${r.grade_scales.version})` : "—"} · First published: {formatDateTime(r.first_published_at)} · Last published: {formatDateTime(r.published_at)} · Displayed publication date:{" "}
              <span data-testid="display-date">{r.display_published_on ?? "—"}</span>
            </span>
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
              ? validCert.needs_reissue
                ? "This result changed after the certificate was issued. The certificate still shows the old data — reissue it from Certificates."
                : "Correcting this result does not change the issued certificate. Reissue it from Certificates after a correction."
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
                  const changed = ["theory_marks", "practical_marks", "viva_marks", "status", "grade", "display_published_on", "grade_override"].filter((k) => h.action === "UPDATE" && o[k] !== n[k]);
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
