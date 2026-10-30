import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/roles";
import { GRADES, loadResultReport, passRate } from "@/lib/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { supabase } = await requireRole(ALL_STAFF);
  const { exams, institutes } = await loadResultReport(supabase);
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Result and enrolment statistics. Pass rates and grade distribution count published results only.">
        <Button variant="outline" asChild>
          <a href="/admin/reports/export">
            <Download /> Excel
          </a>
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Results by exam</CardTitle>
          <CardDescription>Draft and submitted results are waiting for review or publication.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="report-exams">
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Draft</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Pass rate</TableHead>
                {GRADES.map((g) => (
                  <TableHead key={g}>{g}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!exams.length && <EmptyRow colSpan={6 + GRADES.length} />}
              {exams.map((e) => (
                <TableRow key={e.code}>
                  <TableCell>
                    <div className="font-mono text-xs">{e.code}</div>
                    <div className="max-w-64 truncate text-xs text-muted-foreground">{e.name}</div>
                  </TableCell>
                  <TableCell>{e.total}</TableCell>
                  <TableCell>{e.byStatus.draft ?? 0}</TableCell>
                  <TableCell>{e.byStatus.submitted ?? 0}</TableCell>
                  <TableCell>{e.published}</TableCell>
                  <TableCell className="font-medium">{passRate(e.passed, e.published)}</TableCell>
                  {GRADES.map((g) => (
                    <TableCell key={g}>{e.grades[g] ?? 0}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>By institute</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="report-institutes">
            <TableHeader>
              <TableRow>
                <TableHead>Institute</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Published results</TableHead>
                <TableHead>Passed</TableHead>
                <TableHead>Pass rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!institutes.length && <EmptyRow colSpan={5} />}
              {institutes.map((i) => (
                <TableRow key={i.code}>
                  <TableCell>
                    <span className="font-mono text-xs">{i.code}</span> {i.name}
                  </TableCell>
                  <TableCell>{i.students}</TableCell>
                  <TableCell>{i.published}</TableCell>
                  <TableCell>{i.passed}</TableCell>
                  <TableCell className="font-medium">{passRate(i.passed, i.published)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
