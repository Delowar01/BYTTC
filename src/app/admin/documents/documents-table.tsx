import Link from "next/link";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionButton } from "@/components/admin/action-button";
import { documentState } from "@/lib/documents/state";
import { formatDate } from "@/lib/utils";
import { reissueDocument, revokeDocument } from "./actions";

export type DocRow = {
  id: string;
  doc_type: string;
  document_no: string;
  status: string;
  valid_until: string | null;
  issued_at: string;
  revoke_reason: string | null;
  data: unknown;
};

export const DOC_COLUMNS = "id, doc_type, document_no, status, valid_until, issued_at, revoke_reason, data";

export function DocumentsTable({ rows, canPublish, kind }: { rows: DocRow[]; canPublish: boolean; kind: "admit_card" | "registration_card" }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document no.</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>{kind === "admit_card" ? "Exam / seat" : "Course / session"}</TableHead>
          <TableHead>Issued</TableHead>
          {kind === "registration_card" && <TableHead>Valid until</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!rows.length && <EmptyRow colSpan={kind === "admit_card" ? 6 : 7} text="No documents issued." />}
        {rows.map((d) => {
          const s = d.data as Record<string, string>;
          const state = documentState(d);
          return (
            <TableRow key={d.id} data-testid="document-row">
              <TableCell className="font-mono text-xs">
                <Link href={`/admin/documents/${d.id}`} className="underline-offset-2 hover:underline">
                  {d.document_no}
                </Link>
              </TableCell>
              <TableCell>
                <div>{s.student_name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {s.roll_no} · {s.institute_code}
                </div>
              </TableCell>
              <TableCell className="max-w-56 truncate text-xs">
                {kind === "admit_card" ? (
                  <>
                    {s.exam_code}
                    <div className="text-muted-foreground">{[s.seat_no && `Seat ${s.seat_no}`, s.examinee_type].filter(Boolean).join(" · ")}</div>
                  </>
                ) : (
                  <>
                    {s.course_title}
                    <div className="text-muted-foreground">{s.session_name}</div>
                  </>
                )}
              </TableCell>
              <TableCell>{formatDate(d.issued_at)}</TableCell>
              {kind === "registration_card" && <TableCell>{d.valid_until ? formatDate(d.valid_until) : "—"}</TableCell>}
              <TableCell>
                <StatusBadge status={state} />
                {d.revoke_reason && (
                  <div className="max-w-40 truncate text-xs text-muted-foreground" title={d.revoke_reason}>
                    {d.revoke_reason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/admin/documents/${d.id}/pdf`} target="_blank" rel="noopener">
                      <FileDown /> PDF
                    </a>
                  </Button>
                  {canPublish && d.status === "valid" && (
                    <>
                      <ActionButton action={reissueDocument.bind(null, d.id)} label="Reissue" reasonPrompt="Reason for reissue (the current document will be marked superseded):" />
                      <ActionButton action={revokeDocument.bind(null, d.id)} label="Revoke" variant="destructive" reasonPrompt="Reason for revocation (recorded in the audit log):" />
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
