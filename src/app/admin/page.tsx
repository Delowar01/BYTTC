import Link from "next/link";
import { Building2, BookOpen, GraduationCap, Inbox, Upload, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, isCentral } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const { denied } = await searchParams;
  const central = isCentral(profile.role);

  const count = async (table: "institutes" | "students" | "courses" | "exams" | "results" | "contact_messages", filter?: [string, string | boolean]) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count } = await q;
    return count ?? 0;
  };

  const [institutesApproved, institutesPending, students, courses, exams, draft, submitted, published, unread, batches] =
    await Promise.all([
      count("institutes", ["status", "approved"]),
      count("institutes", ["status", "pending"]),
      count("students"),
      count("courses"),
      count("exams"),
      count("results", ["status", "draft"]),
      count("results", ["status", "submitted"]),
      count("results", ["status", "published"]),
      central ? count("contact_messages", ["is_read", false]) : Promise.resolve(0),
      supabase
        .from("import_batches")
        .select("id, kind, file_name, status, total_rows, error_rows, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const { data: offered } = central ? { data: null } : await supabase.from("institute_courses").select("courses(code, title_en)");

  const stats = [
    { label: "Approved institutes", value: institutesApproved, sub: `${institutesPending} pending approval`, icon: Building2, href: "/admin/institutes", show: central },
    { label: "Students", value: students, sub: "registered", icon: Users, href: "/admin/students", show: true },
    { label: "Courses", value: courses, sub: `${exams} exams configured`, icon: BookOpen, href: "/admin/courses", show: central },
    { label: "Published results", value: published, sub: `${draft} draft · ${submitted} submitted`, icon: GraduationCap, href: "/admin/results", show: true },
    { label: "Unread messages", value: unread, sub: "from contact form", icon: Inbox, href: "/admin/messages", show: central },
  ].filter((s) => s.show);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of institutes, students, courses and results.</p>
        </div>
        <Button asChild>
          <Link href="/admin/results/import">
            <Upload /> Upload results
          </Link>
        </Button>
      </div>
      {denied && (
        <Alert variant="destructive">
          <AlertDescription>You do not have permission to open that page.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="gap-2 py-4 transition-colors hover:border-primary/40">
              <CardHeader className="px-4">
                <CardDescription className="flex items-center justify-between">
                  {s.label} <s.icon className="size-4" />
                </CardDescription>
                <CardTitle className="text-3xl" data-testid={`stat-${s.label}`}>
                  {s.value.toLocaleString("en")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs text-muted-foreground">{s.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {offered && (
        <Card>
          <CardHeader>
            <CardTitle>{profile.institutes?.name_en}</CardTitle>
            <CardDescription>
              Courses your institute may enrol students in. {draft > 0 && `${draft} draft result(s) are waiting to be submitted for central review.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {offered.length === 0 && <span className="text-sm text-muted-foreground">No courses assigned yet. Contact the central office.</span>}
            {offered.map((o) => (
              <span key={o.courses?.code} className="rounded-md border px-2 py-1 text-sm">
                {o.courses?.code} — {o.courses?.title_en}
              </span>
            ))}
            <Button variant="outline" size="sm" asChild className="ml-auto">
              <Link href="/admin/results/entry">Marks entry</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Recent uploads</CardTitle>
          <CardDescription>Latest bulk imports. Imported results stay in draft until published.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(batches.data ?? []).length === 0 && <EmptyRow colSpan={5} text="No uploads yet." />}
              {(batches.data ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link className="text-primary hover:underline" href={`/admin/imports/${b.id}`}>
                      {b.file_name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{b.kind}</TableCell>
                  <TableCell>
                    {b.total_rows}
                    {b.error_rows > 0 && <span className="text-destructive"> ({b.error_rows} errors)</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(b.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
