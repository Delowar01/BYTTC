import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, isCentral } from "@/lib/roles";
import { saveMarks, submitForReview } from "./actions";
import { MarksGrid, type MarksRow } from "./marks-grid";

export const metadata = { title: "Marks entry" };
const MAX_ROWS = 300;

export default async function MarksEntryPage({ searchParams }: PageProps<"/admin/results/entry">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const examId = typeof sp.exam === "string" ? sp.exam : "";
  const allSessions = sp.sessions === "all";
  const central = isCentral(profile.role);

  // Tenants only see exams for courses assigned to their institute.
  const [{ data: exams }, { data: assigned }] = await Promise.all([
    supabase.from("exams").select("id, code, name, course_id, session_id, theory_full_marks, practical_full_marks, pass_marks").eq("is_active", true).order("code"),
    central ? Promise.resolve({ data: null }) : supabase.from("institute_courses").select("course_id"),
  ]);
  const allowedCourses = assigned ? new Set(assigned.map((a) => a.course_id)) : null;
  const visibleExams = (exams ?? []).filter((e) => !allowedCourses || allowedCourses.has(e.course_id));
  const exam = visibleExams.find((e) => e.id === examId);

  let rows: MarksRow[] = [];
  let truncated = false;
  let draftCount = 0;
  if (exam) {
    let q = supabase.from("students").select("id, roll_no, name_en, institutes(code)").eq("course_id", exam.course_id).eq("status", "active").order("roll_no").limit(MAX_ROWS + 1);
    if (!allSessions) q = q.eq("session_id", exam.session_id);
    const { data: students } = await q;
    truncated = (students?.length ?? 0) > MAX_ROWS;
    const list = (students ?? []).slice(0, MAX_ROWS);
    const { data: results } = await supabase.from("results").select("id, student_id, status, theory_marks, practical_marks, remarks, grade").eq("exam_id", exam.id).in("student_id", list.map((s) => s.id));
    const byStudent = new Map((results ?? []).map((r) => [r.student_id, r]));
    draftCount = (results ?? []).filter((r) => r.status === "draft").length;
    rows = list.map((s) => {
      const r = byStudent.get(s.id);
      return { studentId: s.id, roll: s.roll_no, name: s.name_en, institute: s.institutes?.code ?? "", resultId: r?.id ?? null, status: r?.status ?? null, theory: r?.theory_marks ?? null, practical: r?.practical_marks ?? null, remarks: r?.remarks ?? null, grade: r?.grade ?? null };
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Marks entry" description="Enter marks per exam. Marks are saved as drafts; grades are calculated automatically. Publication is done by central administrators." />
      <Card>
        <CardContent>
          <form className="flex flex-wrap items-center gap-3">
            <NativeSelect name="exam" defaultValue={examId} className="max-w-md" aria-label="Exam">
              <option value="">Select an exam…</option>
              {visibleExams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sessions" value="all" defaultChecked={allSessions} className="size-4" /> Include students from other sessions
            </label>
            <Button type="submit" variant="outline">Load students</Button>
          </form>
        </CardContent>
      </Card>
      {exam && (
        <Card>
          <CardHeader>
            <CardTitle>{exam.name}</CardTitle>
            <CardDescription>
              Full marks: theory {Number(exam.theory_full_marks)}, practical {Number(exam.practical_full_marks)} · pass mark {Number(exam.pass_marks)} · {rows.length} student(s)
              {truncated && ` (showing the first ${MAX_ROWS}; use bulk upload for larger cohorts)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active students are enrolled in this exam&apos;s course{allSessions ? "" : " and session"}.</p>
            ) : (
              <MarksGrid action={saveMarks.bind(null, exam.id)} rows={rows} theoryFull={Number(exam.theory_full_marks)} practicalFull={Number(exam.practical_full_marks)} />
            )}
            {!central && draftCount > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950">
                <span>{draftCount} draft result(s) are not yet submitted to the central office.</span>
                <ActionButton action={submitForReview.bind(null, exam.id)} label="Submit for central review" variant="default" confirm="Submit all draft results of this exam? You can still edit them until they are published." />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
