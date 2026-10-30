import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { CENTRAL, PUBLISHERS } from "@/lib/roles";
import { escapeLike } from "@/lib/utils";
import { deleteCourse } from "./actions";

export const metadata = { title: "Courses" };

export default async function CoursesPage({ searchParams }: PageProps<"/admin/courses">) {
  const { supabase, profile } = await requireRole(CENTRAL);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  let query = supabase.from("courses").select("*").order("sort_order").order("code");
  if (q) {
    const t = escapeLike(q);
    query = query.or(`code.ilike.%${t}%,title_en.ilike.%${t}%,title_bn.ilike.%${t}%`);
  }
  const { data: courses, error } = await query;
  const canDelete = PUBLISHERS.includes(profile.role);

  return (
    <div>
      <PageHeader title="Courses" description="Courses shown on the website and used for enrolment and exams." action={{ href: "/admin/courses/new", label: "New course" }} />
      {sp.saved && (
        <Alert variant="success" className="mb-4">
          <AlertDescription className="text-inherit">Course saved.</AlertDescription>
        </Alert>
      )}
      {error && <p className="text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <form className="mb-4 flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search code or title" className="max-w-xs" />
            <Button variant="outline" type="submit">Search</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Fee (Tk)</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!courses?.length && <EmptyRow colSpan={6} />}
              {courses?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.title_en}</div>
                    <div className="text-xs text-muted-foreground">{c.title_bn}</div>
                  </TableCell>
                  <TableCell>{c.duration_months ? `${c.duration_months} months` : "—"}</TableCell>
                  <TableCell>{c.fee ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.is_published ? "published" : "draft"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/courses/${c.id}`}>Edit</Link>
                      </Button>
                      {canDelete && (
                        <ActionButton action={deleteCourse.bind(null, c.id)} label="Delete" variant="destructive" confirm={`Delete course ${c.code}? Courses used by students or exams cannot be deleted.`} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
