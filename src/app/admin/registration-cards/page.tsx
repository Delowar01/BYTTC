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
import { issueRegistrationCards } from "../documents/actions";
import { DOC_COLUMNS, DocumentsTable, type DocRow } from "../documents/documents-table";
import { IssueDocumentsForm } from "../documents/issue-documents-form";

export const metadata = { title: "Registration cards" };
const BULK_PART = 50;

export default async function RegistrationCardsPage({ searchParams }: PageProps<"/admin/registration-cards">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [course, session, institute, q, status] = [str("course"), str("session"), str("institute"), str("q"), str("status")];
  const { from, to, page } = pageRange(Number(sp.page));
  const canPublish = PUBLISHERS.includes(profile.role);
  const central = isCentral(profile.role);

  const [{ data: courses }, { data: sessions }, { data: institutes }, { data: template }, { data: settings }] = await Promise.all([
    supabase.from("courses").select("id, code, title_en").order("code"),
    supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    central ? supabase.from("institutes").select("id, code, name_en").eq("status", "approved").order("code") : Promise.resolve({ data: [] }),
    supabase.from("document_templates").select("name, version").eq("doc_type", "registration_card").eq("status", "active").maybeSingle(),
    supabase.from("site_settings").select("registration_card_validity_years").eq("id", 1).single(),
  ]);

  let query = supabase.from("documents").select(DOC_COLUMNS, { count: "exact" }).eq("doc_type", "registration_card").order("issued_at", { ascending: false }).range(from, to);
  if (institute) query = query.eq("institute_id", institute);
  if (status === "valid" || status === "revoked") query = query.eq("status", status);
  if (q) {
    const t = escapeLike(q);
    query = query.or(`document_no.ilike.%${t}%,data->>roll_no.ilike.%${t}%,data->>student_name.ilike.%${t}%,data->>registration_no.ilike.%${t}%`);
  }
  const { data: docs, count, error } = await query;

  // Students for issuing: needs at least a course or an institute filter.
  const filtered = !!(course || institute || session);
  let students: { id: string; label: string; issued: boolean }[] = [];
  let ids: string[] = [];
  if (filtered) {
    let sq = supabase.from("students").select("id, roll_no, registration_no, name_en, institutes(code)").eq("status", "active").order("roll_no").limit(1000);
    if (course) sq = sq.eq("course_id", course);
    if (session) sq = sq.eq("session_id", session);
    if (institute) sq = sq.eq("institute_id", institute);
    const { data: rows } = await sq;
    ids = (rows ?? []).map((s) => s.id);
    const { data: issued } = ids.length
      ? await supabase.from("documents").select("student_id").eq("doc_type", "registration_card").eq("status", "valid").in("student_id", ids)
      : { data: [] };
    const have = new Set((issued ?? []).map((d) => d.student_id));
    students = (rows ?? []).map((s) => ({ id: s.id, label: `${s.roll_no} — ${s.name_en} (${(s.institutes as { code: string } | null)?.code ?? ""})`, issued: have.has(s.id) }));
  }
  const validCount = students.filter((s) => s.issued).length;
  const parts = Math.ceil(validCount / BULK_PART);
  const years = settings?.registration_card_validity_years;
  const bulkParams = new URLSearchParams({ type: "registration_card", ...(course && { course }), ...(session && { session }), ...(institute && { institute }) });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration cards"
        description={`Registration cards with photo and QR verification. Default validity: ${years ? `${years} year(s) from issue` : "no expiry (set it in Settings)"}. Active template: ${template ? `${template.name} v${template.version}` : "none — activate one under Document templates"}.`}
      />
      <Card>
        <CardContent>
          <form className="flex flex-wrap gap-2">
            <NativeSelect name="course" defaultValue={course} className="w-56" aria-label="Course">
              <option value="">All courses</option>
              {courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title_en}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="session" defaultValue={session} className="w-48" aria-label="Session">
              <option value="">All sessions</option>
              {sessions?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
            <Input name="q" defaultValue={q} placeholder="Document no., roll, reg. or name" className="max-w-xs" />
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

      {canPublish && (
        <Card>
          <CardHeader>
            <CardTitle>Issue registration cards</CardTitle>
            <CardDescription>{filtered ? "Each student can hold one valid registration card; corrections are made by reissuing." : "Filter by course, session or institute to list students."}</CardDescription>
          </CardHeader>
          {filtered && (
            <CardContent>
              <IssueDocumentsForm key={validCount} action={issueRegistrationCards} students={students} kind="registration_card" />
            </CardContent>
          )}
        </Card>
      )}

      {filtered && parts > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Bulk PDF of valid cards{parts > 1 ? ` (${BULK_PART} per file)` : ""}:</span>
          {Array.from({ length: parts }, (_, i) => (
            <Button key={i} variant="outline" size="sm" asChild>
              <a href={`/admin/documents/pdf?${bulkParams.toString()}&part=${i + 1}`}>
                <FileDown /> {parts > 1 ? `Part ${i + 1}` : "Download all"}
              </a>
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <DocumentsTable rows={(docs ?? []) as DocRow[]} canPublish={canPublish} kind="registration_card" />
          <Pagination page={page} total={count ?? 0} basePath="/admin/registration-cards" params={{ course, session, institute, q, status }} />
        </CardContent>
      </Card>
    </div>
  );
}
