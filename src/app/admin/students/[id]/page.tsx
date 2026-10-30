import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, isCentral } from "@/lib/roles";
import { FileUploadForm } from "@/components/admin/file-upload-form";
import { courseDuration, photoUrl } from "@/lib/photos";
import { documentState } from "@/lib/documents/state";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/documents/types";
import { formatDate } from "@/lib/utils";
import { deleteStudent, deleteStudentDocument, removeStudentPhoto, saveStudent, uploadStudentDocument, uploadStudentPhoto } from "../actions";

export default async function StudentFormPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const central = isCentral(profile.role);
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const [{ data: institutes }, { data: allCourses }, { data: sessions }, results, { data: assigned }, { data: issuedDocs }, { data: certs }] = await Promise.all([
    supabase.from("institutes").select("id, code, name_en, status").order("code"),
    supabase.from("courses").select("id, code, title_en, duration_months").order("code"),
    supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    isNew
      ? Promise.resolve({ data: [] })
      : supabase.from("results").select("id, total_marks, grade, status, exams(code, name)").eq("student_id", id),
    central ? Promise.resolve({ data: null }) : supabase.from("institute_courses").select("course_id"),
    isNew
      ? Promise.resolve({ data: [] })
      : supabase.from("documents").select("id, doc_type, document_no, status, valid_until, revoke_reason, issued_at, data").eq("student_id", id).order("issued_at", { ascending: false }),
    isNew ? Promise.resolve({ data: [] }) : supabase.from("certificates").select("id, certificate_no, status, issued_at, revoke_reason").eq("student_id", id).order("issued_at", { ascending: false }),
  ]);
  const issued = [
    ...(certs ?? []).map((c) => ({ key: c.id, type: "Certificate", no: c.certificate_no, state: c.status, issuedAt: c.issued_at, href: `/admin/certificates/${c.id}/pdf`, detail: null as string | null })),
    ...(issuedDocs ?? []).map((d) => ({
      key: d.id,
      type: DOC_TYPE_LABELS[d.doc_type as DocType],
      no: d.document_no,
      state: documentState(d),
      issuedAt: d.issued_at,
      href: `/admin/documents/${d.id}/pdf`,
      detail: `/admin/documents/${d.id}`,
    })),
  ].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  // Institute users may only enrol in courses assigned to their institute.
  const allowed = assigned ? new Set(assigned.map((a) => a.course_id)) : null;
  const courses = (allCourses ?? []).filter((c) => !allowed || allowed.has(c.id) || c.id === row?.course_id);

  const { data: docs } = row
    ? await supabase.storage.from("private-documents").list(`institutes/${row.institute_id}/students/${row.id}`, { sortBy: { column: "created_at", order: "desc" } })
    : { data: [] };

  const standardCourse = (allCourses ?? []).find((c) => c.id === row?.course_id);
  const courseOf = standardCourse ? courseDuration(standardCourse.duration_months) : "";
  const photo = row ? await photoUrl(supabase, row.photo_path) : null;

  const fields: FieldDef[] = [
    { name: "institute_id", label: "Institute", type: "select", required: true, defaultValue: row?.institute_id ?? (central ? "" : profile.institute_id), options: (institutes ?? []).filter((i) => i.status === "approved" || i.id === row?.institute_id).map((i) => ({ value: i.id, label: `${i.code} — ${i.name_en}` })), section: "Enrolment" },
    { name: "course_id", label: "Course", type: "select", required: true, defaultValue: row?.course_id, options: (courses ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title_en}` })) },
    { name: "session_id", label: "Session", type: "select", required: true, defaultValue: row?.session_id, options: (sessions ?? []).map((s) => ({ value: s.id, label: s.name })) },
    { name: "status", label: "Status", type: "select", required: true, defaultValue: row?.status ?? "active", options: ["active", "completed", "dropped"].map((v) => ({ value: v, label: v })) },
    { name: "roll_no", label: "Roll number", defaultValue: row?.roll_no, help: isNew ? "Leave blank to generate automatically." : undefined },
    { name: "registration_no", label: "Registration number", defaultValue: row?.registration_no, help: isNew ? "Leave blank to generate a random number." : undefined },
    { name: "name_en", label: "Name (English)", required: true, defaultValue: row?.name_en, section: "Personal details" },
    { name: "name_bn", label: "Name (Bangla)", defaultValue: row?.name_bn },
    { name: "father_name", label: "Father's name", defaultValue: row?.father_name },
    { name: "mother_name", label: "Mother's name", defaultValue: row?.mother_name },
    { name: "date_of_birth", label: "Date of birth", type: "date", defaultValue: row?.date_of_birth },
    { name: "gender", label: "Gender", type: "select", defaultValue: row?.gender, options: ["male", "female", "other"].map((v) => ({ value: v, label: v })) },
    { name: "phone", label: "Phone", defaultValue: row?.phone },
    { name: "email", label: "Email", type: "email", defaultValue: row?.email },
    { name: "address", label: "Address", type: "textarea", rows: 2, defaultValue: row?.address },
    { name: "thana", label: "Thana / upazila", defaultValue: row?.thana },
    { name: "district", label: "District", defaultValue: row?.district },
    { name: "national_id", label: "NID / birth registration no. (private)", defaultValue: row?.national_id, help: "Confidential. Never shown publicly or exported.", section: "Private identifiers" },
    { name: "passport_no", label: "Passport number (optional, private)", defaultValue: row?.passport_no, help: "Lets the student search results with passport + roll or registration. Never displayed or exported." },
    { name: "enrollment_date", label: "Registration / enrolment date", type: "date", defaultValue: row?.enrollment_date, section: "Academic record" },
    { name: "passing_year", label: "Passing year", type: "number", defaultValue: row?.passing_year },
    { name: "course_duration_override", label: "Duration override (exceptional, audited)", defaultValue: row?.course_duration_override, help: `Leave blank to use the course's standard duration${courseOf ? ` (${courseOf})` : ""}.` },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={isNew ? "New student" : row!.name_en} description={row ? `Roll ${row.roll_no} · Registration ${row.registration_no}` : undefined} />
      {sp.saved && (
        <Alert variant="success">
          <AlertDescription className="text-inherit">Student saved.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent>
          <EntityForm action={saveStudent.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/students" />
        </CardContent>
      </Card>
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>Student photo</CardTitle>
            <CardDescription>JPG, PNG or WebP, at least 150×150 pixels, up to 5 MB. Stored privately and reused on results, certificates, admit and registration cards.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-start gap-6">
            {photo ? (
              <img src={photo} alt={`Photo of ${row.name_en}`} className="h-40 w-32 rounded border object-cover" data-testid="student-photo" />
            ) : (
              <div className="flex h-40 w-32 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">No photo</div>
            )}
            <div className="space-y-3">
              <FileUploadForm action={uploadStudentPhoto.bind(null, row.id)} accept="image/jpeg,image/png,image/webp" label={photo ? "Replace photo" : "Upload photo"} inputLabel="Photo file" />
              {photo && <ActionButton action={removeStudentPhoto.bind(null, row.id)} label="Remove photo" variant="ghost" confirm="Remove this photo? Documents already issued keep their copy." />}
            </div>
          </CardContent>
        </Card>
      )}
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>Private documents</CardTitle>
            <CardDescription>ID copies, photos or previous certificates. Stored privately; links expire after 60 seconds and every view is logged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm" data-testid="student-documents">
              {!docs?.some((d) => d.id) && <li className="text-muted-foreground">No documents.</li>}
              {docs?.filter((d) => d.id).map((d) => (
                <li key={d.name} className="flex flex-wrap items-center gap-3">
                  <a className="text-primary hover:underline" href={`/admin/students/${row.id}/document?name=${encodeURIComponent(d.name)}`} target="_blank" rel="noopener">
                    {d.name.replace(/^\d+-/, "")}
                  </a>
                  {central && <ActionButton action={deleteStudentDocument.bind(null, row.id, d.name)} label="Delete" variant="ghost" confirm="Delete this document?" />}
                </li>
              ))}
            </ul>
            <FileUploadForm action={uploadStudentDocument.bind(null, row.id)} accept="application/pdf,image/jpeg,image/png" />
          </CardContent>
        </Card>
      )}
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Students with results cannot be deleted.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!results.data?.length && <EmptyRow colSpan={5} text="No results yet." />}
                {results.data?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.exams?.code}</TableCell>
                    <TableCell>{r.total_marks}</TableCell>
                    <TableCell>{r.grade}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link className="text-primary hover:underline" href={`/admin/results/${r.id}`}>
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4">
              <ActionButton action={deleteStudent.bind(null, row.id)} label="Delete student" variant="destructive" confirm={`Delete ${row.name_en} (roll ${row.roll_no})?`} />
            </div>
          </CardContent>
        </Card>
      )}
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>Issued documents</CardTitle>
            <CardDescription>Certificates, admit cards and registration cards issued to this student. Issue new ones from the Academic documents menu.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="issued-documents">
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!issued.length && <EmptyRow colSpan={5} text="No documents issued yet." />}
                {issued.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell>{d.type}</TableCell>
                    <TableCell className="font-mono text-xs">{d.detail ? <Link href={d.detail} className="hover:underline">{d.no}</Link> : d.no}</TableCell>
                    <TableCell>{formatDate(d.issuedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.state} />
                    </TableCell>
                    <TableCell className="text-right">
                      <a className="text-primary hover:underline" href={d.href} target="_blank" rel="noopener">
                        PDF
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
