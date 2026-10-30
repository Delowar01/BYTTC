import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, isCentral } from "@/lib/roles";
import { readStudentFilters, studentQuery } from "@/lib/students";
import { pageRange } from "@/lib/utils";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const f = readStudentFilters(sp);
  const { from, to, page } = pageRange(Number(sp.page));
  const central = isCentral(profile.role);

  const [{ data: students, count, error }, { data: institutes }, { data: courses }, { data: sessions }] = await Promise.all([
    studentQuery(supabase, f, true).range(from, to),
    supabase.from("institutes").select("id, code, name_en").order("code"),
    supabase.from("courses").select("id, code, title_en").order("code"),
    supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
  ]);
  const exportQs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <PageHeader title="Students" description={central ? "All registered students across institutes." : "Students of your institute."} action={{ href: "/admin/students/new", label: "New student" }}>
        <Button variant="outline" asChild>
          <Link href="/admin/students/import">
            <Upload /> Import
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/admin/students/export?format=xlsx&${exportQs}`}>
            <Download /> Excel
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/admin/students/export?format=csv&${exportQs}`}>
            <Download /> CSV
          </a>
        </Button>
      </PageHeader>
      {sp.deleted && (
        <Alert variant="success" className="mb-4">
          <AlertDescription className="text-inherit">Student deleted.</AlertDescription>
        </Alert>
      )}
      {error && <p className="mb-4 text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Input name="q" defaultValue={f.q} placeholder="Name, roll, registration, phone" className="lg:col-span-2" />
            {central && (
              <NativeSelect name="institute" defaultValue={f.institute} aria-label="Institute">
                <option value="">All institutes</option>
                {institutes?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name_en}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect name="course" defaultValue={f.course} aria-label="Course">
              <option value="">All courses</option>
              {courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title_en}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="session" defaultValue={f.session} aria-label="Session">
              <option value="">All sessions</option>
              {sessions?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            <div className="flex gap-2">
              <NativeSelect name="status" defaultValue={f.status} aria-label="Status">
                <option value="">Any status</option>
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="dropped">dropped</option>
              </NativeSelect>
              <Button variant="outline" type="submit">Filter</Button>
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Institute</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!students?.length && <EmptyRow colSpan={8} />}
              {students?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.roll_no}</TableCell>
                  <TableCell className="font-mono">{s.registration_no}</TableCell>
                  <TableCell>
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.name_en}
                    </Link>
                    {s.name_bn && <div className="text-xs text-muted-foreground">{s.name_bn}</div>}
                  </TableCell>
                  <TableCell>{s.institutes?.code}</TableCell>
                  <TableCell>{s.courses?.code}</TableCell>
                  <TableCell>{s.academic_sessions?.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/students/${s.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/admin/students" params={f} />
        </CardContent>
      </Card>
    </div>
  );
}
