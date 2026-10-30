import { FileDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, PUBLISHERS, isCentral } from "@/lib/roles";
import { escapeLike, pageRange } from "@/lib/utils";
import { issueAdmitCards } from "../documents/actions";
import { DOC_COLUMNS, DocumentsTable, type DocRow } from "../documents/documents-table";
import { IssueDocumentsForm } from "../documents/issue-documents-form";

export const metadata = { title: "Admit cards" };
const BULK_PART = 50;

export default async function AdmitCardsPage({ searchParams }: PageProps<"/admin/admit-cards">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [examId, institute, q, status] = [str("exam"), str("institute"), str("q"), str("status")];
  const { from, to, page } = pageRange(Number(sp.page));
  const canPublish = PUBLISHERS.includes(profile.role);
  const central = isCentral(profile.role);

  const [{ data: exams }, { data: institutes }, { data: template }] = await Promise.all([
    supabase.from("exams").select("id, code, name, course_id, session_id, exam_date, exam_time, venue").order("exam_date", { ascending: false, nullsFirst: false }),
    central ? supabase.from("institutes").select("id, code, name_en").eq("status", "approved").order("code") : Promise.resolve({ data: [] }),
    supabase.from("document_templates").select("name, version").eq("doc_type", "admit_card").eq("status", "active").maybeSingle(),
  ]);
  const exam = exams?.find((e) => e.id === examId);

  let query = supabase.from("documents").select(DOC_COLUMNS, { count: "exact" }).eq("doc_type", "admit_card").order("issued_at", { ascending: false }).range(from, to);
  if (exam) query = query.eq("exam_id", exam.id);
  if (institute) query = query.eq("institute_id", institute);
  if (status === "valid" || status === "revoked") query = query.eq("status", status);
  if (q) {
    const t = escapeLike(q);
    query = query.or(`document_no.ilike.%${t}%,data->>roll_no.ilike.%${t}%,data->>student_name.ilike.%${t}%`);
  }
  const { data: docs, count, error } = await query;

  // Eligible students: active, same course and session as the exam.
  let students: { id: string; label: string; issued: boolean }[] = [];
  let validCount = 0;
  if (exam) {
    let sq = supabase.from("students").select("id, roll_no, name_en, institutes(code)").eq("course_id", exam.course_id).eq("session_id", exam.session_id).eq("status", "active").order("roll_no").limit(1000);
    if (institute) sq = sq.eq("institute_id", institute);
    let vq = supabase.from("documents").select("student_id, institute_id").eq("doc_type", "admit_card").eq("exam_id", exam.id).eq("status", "valid");
    if (institute) vq = vq.eq("institute_id", institute);
    const [{ data: rows }, { data: issued }] = await Promise.all([canPublish ? sq : Promise.resolve({ data: [] }), vq]);
    const have = new Set((issued ?? []).map((d) => d.student_id));
    validCount = issued?.length ?? 0;
    students = (rows ?? []).map((s) => ({ id: s.id, label: `${s.roll_no} — ${s.name_en} (${(s.institutes as { code: string } | null)?.code ?? ""})`, issued: have.has(s.id) }));
  }
  const parts = Math.ceil(validCount / BULK_PART);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admit cards"
        description={`Admit cards for an exam, with photo, seat and a QR code for verification. Active template: ${template ? `${template.name} v${template.version}` : "none — activate one under Document templates"}.`}
      />
      <Card>
        <CardContent>
          <form className="flex flex-wrap gap-2">
            <NativeSelect name="exam" defaultValue={examId} className="max-w-md" aria-label="Exam">
              <option value="">All exams</option>
              {exams?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </NativeSelect>
            {central && (
              <NativeSelect name="institute" defaultValue={institute} className="w-56" aria-label="Institute">
                <option value="">All institutes</option>
                {institutes?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name_en}
                  </option>
                ))}
              </NativeSelect>
            )}
            <Input name="q" defaultValue={q} placeholder="Document no., roll or name" className="max-w-xs" />
            <NativeSelect name="status" defaultValue={status} className="w-36" aria-label="Status">
              <option value="">Any status</option>
              <option value="valid">valid</option>
              <option value="revoked">revoked</option>
            </NativeSelect>
            <Button variant="outline" type="submit">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {exam && canPublish && (
        <Card>
          <CardHeader>
            <CardTitle>Issue admit cards — {exam.code}</CardTitle>
            <CardDescription>
              {[exam.exam_date, exam.exam_time, exam.venue].filter(Boolean).join(" · ") || "Set the exam date, time and venue on the exam to print them on the cards."} Each card stores a snapshot; later changes need a reissue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IssueDocumentsForm key={students.filter((s) => s.issued).length} action={issueAdmitCards} students={students} kind="admit_card" exam={exam.id} />
          </CardContent>
        </Card>
      )}

      {exam && parts > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Bulk PDF of valid cards{parts > 1 ? ` (${BULK_PART} per file)` : ""}:</span>
          {Array.from({ length: parts }, (_, i) => (
            <Button key={i} variant="outline" size="sm" asChild>
              <a href={`/admin/documents/pdf?type=admit_card&exam=${exam.id}${institute ? `&institute=${institute}` : ""}&part=${i + 1}`}>
                <FileDown /> {parts > 1 ? `Part ${i + 1}` : "Download all"}
              </a>
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <DocumentsTable rows={(docs ?? []) as DocRow[]} canPublish={canPublish} kind="admit_card" />
          <Pagination page={page} total={count ?? 0} basePath="/admin/admit-cards" params={{ exam: examId, institute, q, status }} />
        </CardContent>
      </Card>
    </div>
  );
}
