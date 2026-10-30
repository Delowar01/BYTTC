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
import { deleteStudent, saveStudent } from "../actions";

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
  const [{ data: institutes }, { data: allCourses }, { data: sessions }, results, { data: assigned }] = await Promise.all([
    supabase.from("institutes").select("id, code, name_en, status").order("code"),
    supabase.from("courses").select("id, code, title_en").order("code"),
    supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    isNew
      ? Promise.resolve({ data: [] })
      : supabase.from("results").select("id, total_marks, grade, status, exams(code, name)").eq("student_id", id),
    central ? Promise.resolve({ data: null }) : supabase.from("institute_courses").select("course_id"),
  ]);
  // Institute users may only enrol in courses assigned to their institute.
  const allowed = assigned ? new Set(assigned.map((a) => a.course_id)) : null;
  const courses = (allCourses ?? []).filter((c) => !allowed || allowed.has(c.id) || c.id === row?.course_id);

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
    { name: "national_id", label: "NID / birth registration no. (private)", defaultValue: row?.national_id, help: "Confidential. Never shown publicly or exported." },
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
    </div>
  );
}
