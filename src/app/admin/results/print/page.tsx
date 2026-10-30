import { notFound } from "next/navigation";
import { z } from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/public/print-button";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/roles";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Tabulation sheet" };

/** Printable tabulation sheet of an exam's results (what the user may see). */
export default async function TabulationPage({ searchParams }: PageProps<"/admin/results/print">) {
  const { supabase } = await requireRole(ALL_STAFF);
  const examId = z.uuid().safeParse((await searchParams).exam);
  if (!examId.success) notFound();
  const [{ data: exam }, { data: settings }, { data: results }] = await Promise.all([
    supabase.from("exams").select("code, name, exam_date, theory_full_marks, practical_full_marks, pass_marks, courses(title_en), academic_sessions(name)").eq("id", examId.data).maybeSingle(),
    supabase.from("site_settings").select("org_name_en").eq("id", 1).single(),
    supabase.from("results").select("theory_marks, practical_marks, total_marks, grade, grade_point, is_pass, status, students!inner(roll_no, name_en), institutes(code)").eq("exam_id", examId.data).order("students(roll_no)"),
  ]);
  if (!exam) notFound();
  const list = results ?? [];
  const published = list.filter((r) => r.status === "published");
  const passed = published.filter((r) => r.is_pass).length;
  return (
    <div className="mx-auto max-w-5xl space-y-4 bg-background p-2 print:p-0">
      <div className="no-print flex justify-end">
        <PrintButton label="Print" />
      </div>
      <header className="text-center">
        <p className="text-lg font-bold">{settings?.org_name_en}</p>
        <p className="font-semibold">Tabulation sheet — {exam.name}</p>
        <p className="text-sm text-muted-foreground">
          {exam.code} · {exam.courses?.title_en} · {exam.academic_sessions?.name} · Exam date {formatDate(exam.exam_date)} · Full marks {Number(exam.theory_full_marks)} + {Number(exam.practical_full_marks)}, pass {Number(exam.pass_marks)}
        </p>
      </header>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Roll</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Institute</TableHead>
            <TableHead>Theory</TableHead>
            <TableHead>Practical</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r, i) => (
            <TableRow key={r.students.roll_no}>
              <TableCell>{i + 1}</TableCell>
              <TableCell className="font-mono">{r.students.roll_no}</TableCell>
              <TableCell>{r.students.name_en}</TableCell>
              <TableCell>{r.institutes?.code}</TableCell>
              <TableCell>{r.theory_marks ?? "—"}</TableCell>
              <TableCell>{r.practical_marks ?? "—"}</TableCell>
              <TableCell>{r.total_marks}</TableCell>
              <TableCell>
                {r.grade} ({Number(r.grade_point).toFixed(2)})
              </TableCell>
              <TableCell>{r.is_pass ? "Pass" : "Fail"}</TableCell>
              <TableCell>{r.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm" data-testid="tabulation-summary">
        {list.length} result(s) · {published.length} published · {passed} passed{published.length ? ` (${((passed * 100) / published.length).toFixed(1)}%)` : ""} · printed {formatDate(new Date().toISOString())}
      </p>
      <div className="grid grid-cols-3 gap-8 pt-16 text-center text-xs">
        {["Prepared by", "Checked by", "Controller of Examinations"].map((s) => (
          <div key={s} className="border-t pt-1">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
