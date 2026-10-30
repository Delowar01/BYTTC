import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, PUBLISHERS } from "@/lib/roles";
import { escapeLike } from "@/lib/utils";
import type { GradeRule } from "@/lib/grading";
import { createSingleResult } from "../actions";
import { SingleResultForm, type ExamOption } from "./single-result-form";

export const metadata = { title: "Add single result" };

export default async function NewResultPage({ searchParams }: PageProps<"/admin/results/new">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const studentId = typeof sp.student === "string" ? sp.student : "";

  const { data: student } = studentId
    ? await supabase.from("students").select("id, roll_no, registration_no, name_en, course_id, courses(code, title_en), institutes(code), academic_sessions(name)").eq("id", studentId).maybeSingle()
    : { data: null };

  let matches: { id: string; roll_no: string; registration_no: string; name_en: string; institutes: { code: string } | null; courses: { code: string } | null }[] = [];
  if (!student && q) {
    const t = escapeLike(q);
    const { data } = await supabase.from("students").select("id, roll_no, registration_no, name_en, institutes(code), courses(code)").or(`roll_no.ilike.%${t}%,registration_no.ilike.%${t}%,name_en.ilike.%${t}%`).order("roll_no").limit(20);
    matches = data ?? [];
  }

  let exams: ExamOption[] = [];
  if (student) {
    const [{ data: examRows }, { data: scales }, { data: existing }] = await Promise.all([
      supabase.from("exams").select("id, code, name, theory_full_marks, practical_full_marks, viva_full_marks, pass_marks, grade_scale_code").eq("course_id", student.course_id).eq("is_active", true).order("code"),
      supabase.from("grade_scales").select("code, rules, max_point").eq("is_current", true),
      supabase.from("results").select("id, exam_id").eq("student_id", student.id),
    ]);
    const scaleOf = new Map((scales ?? []).map((s) => [s.code, s]));
    const existingOf = new Map((existing ?? []).map((r) => [r.exam_id, r.id]));
    exams = (examRows ?? []).map((e) => {
      const scale = scaleOf.get(e.grade_scale_code);
      return {
        id: e.id,
        label: `${e.code} — ${e.name}`,
        theory_full: Number(e.theory_full_marks),
        practical_full: Number(e.practical_full_marks),
        viva_full: Number(e.viva_full_marks),
        pass_marks: Number(e.pass_marks),
        rules: ((scale?.rules ?? []) as GradeRule[]).map((r) => ({ ...r, min_percent: Number(r.min_percent), point: Number(r.point) })),
        max_point: Number(scale?.max_point ?? 5),
        existingResultId: existingOf.get(e.id) ?? null,
      };
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Add single result" description="Enter one student's marks without a spreadsheet. The result is saved as a draft; publishing is a separate, authorized step." />
      {!student ? (
        <Card>
          <CardHeader>
            <CardTitle>1. Find the student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2">
              <Input name="q" defaultValue={q} placeholder="Roll, registration number or name" className="max-w-sm" aria-label="Find student" />
              <Button type="submit" variant="outline">Search</Button>
            </form>
            {q && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Institute</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!matches.length && <EmptyRow colSpan={6} text="No matching students." />}
                  {matches.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.roll_no}</TableCell>
                      <TableCell className="font-mono">{m.registration_no}</TableCell>
                      <TableCell>{m.name_en}</TableCell>
                      <TableCell>{m.institutes?.code}</TableCell>
                      <TableCell>{m.courses?.code}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" asChild>
                          <Link href={`/admin/results/new?student=${m.id}`}>Select</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              2. {student.name_en} <span className="font-mono text-sm font-normal text-muted-foreground">roll {student.roll_no} · reg {student.registration_no}</span>
            </CardTitle>
            <CardDescription>
              {student.courses?.code} — {student.courses?.title_en} · {student.academic_sessions?.name} · {student.institutes?.code} ·{" "}
              <Link className="underline" href="/admin/results/new">
                change student
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active exams exist for this course. Create one under Exams first.</p>
            ) : (
              <SingleResultForm action={createSingleResult.bind(null, student.id)} exams={exams} canSetDate={PUBLISHERS.includes(profile.role)} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
