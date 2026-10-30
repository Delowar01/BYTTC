import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { CENTRAL, PUBLISHERS } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { deleteExam } from "./actions";

export const metadata = { title: "Exams" };

export default async function ExamsPage({ searchParams }: PageProps<"/admin/exams">) {
  const { supabase, profile } = await requireRole(CENTRAL);
  const sp = await searchParams;
  const { data: exams } = await supabase
    .from("exams")
    .select("*, courses(code, title_en), academic_sessions(name)")
    .order("exam_date", { ascending: false, nullsFirst: false });
  const canDelete = PUBLISHERS.includes(profile.role);
  return (
    <div>
      <PageHeader title="Exams" description="Each exam belongs to one course and session. Exam codes are used in result import files." action={{ href: "/admin/exams/new", label: "New exam" }} />
      {sp.saved && (
        <Alert variant="success" className="mb-4">
          <AlertDescription className="text-inherit">Exam saved.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Marks (W+P+V / pass)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!exams?.length && <EmptyRow colSpan={8} />}
              {exams?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono">{e.code}</TableCell>
                  <TableCell className="max-w-64 truncate">{e.name}</TableCell>
                  <TableCell>{e.courses?.code}</TableCell>
                  <TableCell>{e.academic_sessions?.name}</TableCell>
                  <TableCell>{formatDate(e.exam_date)}</TableCell>
                  <TableCell>
                    {Number(e.theory_full_marks)}+{Number(e.practical_full_marks)}+{Number(e.viva_full_marks)} / {Number(e.pass_marks)}
                    <div className="text-xs text-muted-foreground">{e.grade_scale_code}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={e.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/results?exam=${e.id}`}>Results</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/exams/${e.id}`}>Edit</Link>
                      </Button>
                      {canDelete && (
                        <ActionButton action={deleteExam.bind(null, e.id)} label="Delete" variant="destructive" confirm={`Delete exam ${e.code}? Exams with results cannot be deleted.`} />
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
