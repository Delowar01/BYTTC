import { FileDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionButton } from "@/components/admin/action-button";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { escapeLike, formatDate, pageRange } from "@/lib/utils";
import { issueForExam, reissueCertificate, revokeCertificate } from "./actions";
import { IssueForm } from "./issue-form";

export const metadata = { title: "Certificates" };
type Snap = { student_name?: string; roll_no?: string; course_title?: string; institute_code?: string; grade?: string; exam_code?: string };

export default async function CertificatesPage({ searchParams }: PageProps<"/admin/certificates">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = sp.status === "valid" || sp.status === "revoked" ? sp.status : "";
  const { from, to, page } = pageRange(Number(sp.page));
  const canPublish = PUBLISHERS.includes(profile.role);

  let query = supabase.from("certificates").select("id, certificate_no, status, issued_at, revoke_reason, snapshot", { count: "exact" }).order("issued_at", { ascending: false }).range(from, to);
  if (q) {
    const t = escapeLike(q);
    query = query.or(`certificate_no.ilike.%${t}%,snapshot->>roll_no.ilike.%${t}%,snapshot->>student_name.ilike.%${t}%`);
  }
  if (status) query = query.eq("status", status);
  const [{ data: certs, count, error }, { data: exams }] = await Promise.all([
    query,
    canPublish ? supabase.from("exams").select("id, code, name").order("code") : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="Certificates are issued for published, passing results. Each has a unique number and a QR code linking to public verification." />
      {canPublish && (
        <Card>
          <CardHeader>
            <CardTitle>Issue certificates</CardTitle>
            <CardDescription>Issues a certificate to every published, passing result of the exam that does not have one yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <IssueForm action={issueForExam} exams={(exams ?? []).map((e) => ({ id: e.id, label: `${e.code} — ${e.name}` }))} />
          </CardContent>
        </Card>
      )}
      {error && <p className="text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <form className="mb-4 flex flex-wrap gap-2">
            <Input name="q" defaultValue={q} placeholder="Certificate no., roll or name" className="max-w-xs" />
            <NativeSelect name="status" defaultValue={status} className="w-36" aria-label="Status">
              <option value="">Any status</option>
              <option value="valid">valid</option>
              <option value="revoked">revoked</option>
            </NativeSelect>
            <Button variant="outline" type="submit">Filter</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate no.</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course / exam</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!certs?.length && <EmptyRow colSpan={7} text="No certificates." />}
              {certs?.map((c) => {
                const s = c.snapshot as Snap;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.certificate_no}</TableCell>
                    <TableCell>
                      <div>{s.student_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{s.roll_no}</div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-xs">
                      {s.course_title}
                      <div className="text-muted-foreground">{s.exam_code}</div>
                    </TableCell>
                    <TableCell>{s.grade}</TableCell>
                    <TableCell>{formatDate(c.issued_at)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                      {c.revoke_reason && <div className="max-w-40 truncate text-xs text-muted-foreground" title={c.revoke_reason}>{c.revoke_reason}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/admin/certificates/${c.id}/pdf`} target="_blank" rel="noopener">
                            <FileDown /> PDF
                          </a>
                        </Button>
                        {canPublish && c.status === "valid" && (
                          <>
                            <ActionButton action={reissueCertificate.bind(null, c.id)} label="Reissue" reasonPrompt="Reason for reissue (e.g. corrected result or name). The current certificate will be revoked:" />
                            <ActionButton action={revokeCertificate.bind(null, c.id)} label="Revoke" variant="destructive" reasonPrompt="Reason for revocation (recorded in the audit log):" />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/admin/certificates" params={{ q, status }} />
        </CardContent>
      </Card>
    </div>
  );
}
