import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileWarning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import type { ImportIssue } from "@/lib/import/results";
import { commitBatch, discardBatch, rollbackBatch, setBatchPublication } from "../actions";

const MAX_ISSUES_SHOWN = 5000;
const PREVIEW_ROWS = 100;

export default async function BatchPage({ params, searchParams }: PageProps<"/admin/imports/[id]">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const { id } = await params;
  const { msg } = await searchParams;
  const { data: b } = await supabase.from("import_batches").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();

  const issues = ((b.errors as ImportIssue[]) ?? []).slice().sort((x, y) => x.row - y.row);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const payload = (b.payload as Record<string, string | number | null>[]) ?? [];
  const canPublish = PUBLISHERS.includes(profile.role);
  const isResults = b.kind === "results";
  const resultCounts = isResults && b.status !== "validated"
    ? await Promise.all(
        (["draft", "submitted", "published", "unpublished"] as const).map(async (s) => {
          const { count } = await supabase.from("results").select("*", { count: "exact", head: true }).eq("batch_id", id).eq("status", s);
          return [s, count ?? 0] as const;
        }),
      )
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title={b.file_name} description={`${isResults ? "Result" : "Student"} import · uploaded ${formatDateTime(b.created_at)}`}>
        {b.file_path && (
          <Button variant="outline" asChild>
            <a href={`/admin/imports/${id}/file`}>
              <Download /> Original file
            </a>
          </Button>
        )}
        {issues.length > 0 && (
          <Button variant="outline" asChild>
            <a href={`/admin/imports/${id}/errors`}>
              <FileWarning /> Error report (CSV)
            </a>
          </Button>
        )}
      </PageHeader>

      {typeof msg === "string" && (
        <Alert variant="success" data-testid="flash">
          <AlertDescription className="text-inherit">{msg}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Status</CardDescription>
            <CardTitle data-testid="batch-status">
              <StatusBadge status={b.status} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total rows</CardDescription>
            <CardTitle className="text-2xl">{b.total_rows}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Valid rows</CardDescription>
            <CardTitle className="text-2xl text-emerald-700" data-testid="valid-rows">{b.valid_rows}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Rows with errors</CardDescription>
            <CardTitle className={b.error_rows ? "text-2xl text-destructive" : "text-2xl"} data-testid="error-rows">{b.error_rows}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            {b.status === "validated" && b.error_rows === 0 && "Validation passed. Commit to save all rows in one transaction" + (isResults ? " as DRAFT results (not visible to the public)." : ".")}
            {b.status === "validated" && b.error_rows > 0 && "This file has errors and cannot be committed. Fix the rows listed below and upload the corrected file."}
            {b.status === "committed" && isResults && "Results are saved as drafts. Publish to make them visible in public result search, or roll back to remove them."}
            {b.status === "committed" && !isResults && "Students were created."}
            {b.status === "published" && "Results are live in public result search."}
            {b.status === "unpublished" && "Results are hidden from the public. Publish again or roll back."}
            {b.status === "rolled_back" && "This batch was rolled back / discarded. Its rows are no longer in the system."}
            {b.status === "failed" && "The commit failed and nothing was saved."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {b.failure_reason && (
            <Alert variant="destructive">
              <AlertTitle>Failure</AlertTitle>
              <AlertDescription>{b.failure_reason}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-3">
            {b.status === "validated" && b.error_rows === 0 && (
              <ActionButton action={commitBatch.bind(null, id, b.kind)} label={isResults ? `Commit ${b.valid_rows} results as draft` : `Create ${b.valid_rows} students`} variant="default" size="default" confirm="Commit this batch?" />
            )}
            {(b.status === "validated" || b.status === "failed") && (
              <ActionButton action={discardBatch.bind(null, id)} label="Discard" confirm="Discard this upload?" size="default" />
            )}
            {isResults && canPublish && (b.status === "committed" || b.status === "unpublished") && (
              <ActionButton action={setBatchPublication.bind(null, id, true)} label="Publish results" variant="default" size="default" confirm="Publish all results in this batch? They will be visible in public result search." />
            )}
            {isResults && canPublish && b.status === "published" && (
              <ActionButton action={setBatchPublication.bind(null, id, false)} label="Unpublish results" variant="destructive" size="default" confirm="Hide all results of this batch from the public?" />
            )}
            {isResults && (b.status === "committed" || b.status === "unpublished") && (
              <ActionButton action={rollbackBatch.bind(null, id)} label="Roll back batch" variant="destructive" size="default" reasonPrompt="Reason for rolling back (all results of this batch will be deleted):" />
            )}
            {isResults && b.status !== "validated" && b.status !== "rolled_back" && (
              <Button variant="outline" asChild>
                <Link href={`/admin/results?batch=${id}`}>View results</Link>
              </Button>
            )}
            {isResults && !canPublish && <p className="self-center text-sm text-muted-foreground">Only central administrators can publish results.</p>}
          </div>
          {resultCounts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Results in this batch: {resultCounts.map(([s, n]) => `${n} ${s}`).join(" · ")}
            </p>
          )}
          <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Committed: {formatDateTime(b.committed_at)}</div>
            <div>Published: {formatDateTime(b.published_at)}</div>
            <div>Unpublished: {formatDateTime(b.unpublished_at)}</div>
            <div>Rolled back: {formatDateTime(b.rolled_back_at)}</div>
            <div className="sm:col-span-2 break-all">SHA-256: {b.file_sha256}</div>
            {b.notes && <div className="sm:col-span-2 whitespace-pre-line">Notes: {b.notes}</div>}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Validation report — {errors.length} error{errors.length === 1 ? "" : "s"}, {warnings.length} warning{warnings.length === 1 ? "" : "s"}
          </CardTitle>
          {issues.length > MAX_ISSUES_SHOWN && <CardDescription>Showing the first {MAX_ISSUES_SHOWN}; download the error report for the full list.</CardDescription>}
        </CardHeader>
        <CardContent>
          <Table data-testid="issues-table">
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Problem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.length === 0 && <EmptyRow colSpan={5} text="No problems found." />}
              {issues.slice(0, MAX_ISSUES_SHOWN).map((i, n) => (
                <TableRow key={n}>
                  <TableCell>{i.row}</TableCell>
                  <TableCell className={i.level === "error" ? "text-destructive" : "text-amber-700"}>{i.level}</TableCell>
                  <TableCell className="font-mono text-xs">{i.column ?? ""}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs">{i.value ?? ""}</TableCell>
                  <TableCell className="whitespace-normal">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {payload.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Valid rows preview</CardTitle>
            <CardDescription>
              Showing {Math.min(PREVIEW_ROWS, payload.length)} of {payload.length} valid rows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                {isResults ? (
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Theory</TableHead>
                    <TableHead>Practical</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Date of birth</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {payload.slice(0, PREVIEW_ROWS).map((r) =>
                  isResults ? (
                    <TableRow key={String(r.row)}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell className="font-mono">{r.roll_no}</TableCell>
                      <TableCell>{r.student_name}</TableCell>
                      <TableCell className="font-mono">{r.exam_code}</TableCell>
                      <TableCell>{r.theory_marks ?? "—"}</TableCell>
                      <TableCell>{r.practical_marks ?? "—"}</TableCell>
                      <TableCell>{r.remarks}</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={String(r.row)}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.name_en}</TableCell>
                      <TableCell className="font-mono">{r.roll_no ?? "(auto)"}</TableCell>
                      <TableCell className="font-mono">{r.registration_no ?? "(auto)"}</TableCell>
                      <TableCell>{r.date_of_birth ?? "—"}</TableCell>
                      <TableCell>{r.phone ?? "—"}</TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
