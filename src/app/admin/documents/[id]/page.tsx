import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionButton } from "@/components/admin/action-button";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { documentState } from "@/lib/documents/state";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/documents/types";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { formatDate, formatDateTime } from "@/lib/utils";
import { reissueDocument, revokeDocument } from "../actions";
import { ReissueForm } from "./reissue-form";

export const metadata = { title: "Document" };

export default async function DocumentPage({ params, searchParams }: PageProps<"/admin/documents/[id]">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const { id } = await params;
  const sp = await searchParams;
  const { data: d } = await supabase
    .from("documents")
    .select("id, doc_type, document_no, status, valid_until, issued_at, revoked_at, revoke_reason, data, student_id, supersedes_id, template_id, document_templates(name, version)")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();
  const [{ data: prev }, { data: next }] = await Promise.all([
    d.supersedes_id ? supabase.from("documents").select("id, document_no").eq("id", d.supersedes_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("documents").select("id, document_no").eq("supersedes_id", d.id).maybeSingle(),
  ]);
  const s = d.data as Record<string, string>;
  const state = documentState(d);
  const canPublish = PUBLISHERS.includes(profile.role);
  const tpl = d.document_templates as { name: string; version: number } | null;
  const back = d.doc_type === "admit_card" ? "/admin/admit-cards" : "/admin/registration-cards";

  const facts: [string, React.ReactNode][] = [
    ["Student", <Link key="s" href={`/admin/students/${d.student_id}`} className="underline">{s.student_name}</Link>],
    ["Roll / registration", `${s.roll_no} / ${s.registration_no}`],
    ["Institute", `${s.institute_code} — ${s.institute_name}`],
    ["Course / session", `${s.course_title} · ${s.session_name}`],
    ...(d.doc_type === "admit_card"
      ? ([
          ["Exam", `${s.exam_code} — ${s.exam_name}`],
          ["Date / time / venue", [s.exam_date, s.exam_time, s.venue].filter(Boolean).join(" · ") || "—"],
          ["Seat / examinee type", `${s.seat_no || "—"} · ${s.examinee_type}`],
        ] as [string, string][])
      : ([["Valid until", d.valid_until ? formatDate(d.valid_until) : "No expiry"]] as [string, string][])),
    ["Issued", formatDateTime(d.issued_at)],
    ["Template", tpl ? `${tpl.name} v${tpl.version}` : "—"],
    ...(d.revoked_at ? ([["Revoked", `${formatDateTime(d.revoked_at)} — ${d.revoke_reason}`]] as [string, string][]) : []),
    ...(prev ? ([["Replaces", <Link key="p" href={`/admin/documents/${prev.id}`} className="font-mono underline">{prev.document_no}</Link>]] as [string, React.ReactNode][]) : []),
    ...(next ? ([["Replaced by", <Link key="n" href={`/admin/documents/${next.id}`} className="font-mono underline">{next.document_no}</Link>]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`${DOC_TYPE_LABELS[d.doc_type as DocType]} ${d.document_no}`} description="Issued documents are snapshots: later record or template changes need a reissue.">
        <StatusBadge status={state} />
        <Button variant="outline" asChild>
          <Link href={back}>Back to list</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/admin/documents/${d.id}/pdf`} target="_blank" rel="noopener">
            <FileDown /> PDF
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/verify?no=${d.document_no}`} target="_blank" rel="noopener">
            Public verification
          </a>
        </Button>
      </PageHeader>
      <SavedAlert show={sp.reissued === "1"} text="Document reissued. The previous document now verifies as superseded." />
      <Card>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2" data-testid="document-facts">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-dashed py-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {canPublish && d.status === "valid" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Reissue with corrections</CardTitle>
            </CardHeader>
            <CardContent>
              <ReissueForm action={reissueDocument.bind(null, d.id)} kind={d.doc_type} defaults={{ seat_no: s.seat_no, examinee_type: s.examinee_type, valid_until: d.valid_until }} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revoke</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">A revoked document verifies as revoked. This cannot be undone; issue a new document if needed.</p>
              <ActionButton action={revokeDocument.bind(null, d.id)} label="Revoke document" variant="destructive" size="default" reasonPrompt="Reason for revocation (recorded in the audit log):" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
