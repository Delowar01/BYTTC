import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm, type FieldDef } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { CENTRAL } from "@/lib/roles";
import { saveExam } from "../actions";

export default async function ExamFormPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { supabase } = await requireRole(CENTRAL);
  const { id } = await params;
  const isNew = id === "new";
  let row = null;
  if (!isNew) {
    const { data } = await supabase.from("exams").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }
  const [{ data: courses }, { data: sessions }, { data: scales }] = await Promise.all([
    supabase.from("courses").select("id, code, title_en").order("code"),
    supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    supabase.from("grade_scales").select("code, name, version").eq("is_current", true).order("code"),
  ]);
  const fields: FieldDef[] = [
    { name: "code", label: "Exam code", required: true, defaultValue: row?.code, help: "Unique, e.g. COA-2027-JUN. Used in import files." },
    { name: "exam_date", label: "Exam date", type: "date", defaultValue: row?.exam_date },
    { name: "exam_time", label: "Exam time", defaultValue: row?.exam_time, help: "Printed on admit cards, e.g. 10:00 AM – 1:00 PM." },
    { name: "venue", label: "Venue", defaultValue: row?.venue, help: "Printed on admit cards." },
    { name: "name", label: "Name", required: true, defaultValue: row?.name, wide: true },
    { name: "course_id", label: "Course", type: "select", required: true, defaultValue: row?.course_id, options: (courses ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title_en}` })) },
    { name: "session_id", label: "Session", type: "select", required: true, defaultValue: row?.session_id, options: (sessions ?? []).map((s) => ({ value: s.id, label: s.name })) },
    { name: "theory_full_marks", label: "Written/theory full marks", type: "number", step: "0.01", required: true, defaultValue: row?.theory_full_marks ?? 70 },
    { name: "practical_full_marks", label: "Practical full marks", type: "number", step: "0.01", required: true, defaultValue: row?.practical_full_marks ?? 30 },
    { name: "viva_full_marks", label: "Viva full marks (0 = no viva)", type: "number", step: "0.01", required: true, defaultValue: row?.viva_full_marks ?? 0 },
    { name: "pass_marks", label: "Pass marks (out of total)", type: "number", step: "0.01", required: true, defaultValue: row?.pass_marks ?? 40 },
    { name: "grade_scale_code", label: "Grading scale", type: "select", required: true, defaultValue: row?.grade_scale_code ?? "GPA5", options: (scales ?? []).map((g) => ({ value: g.code, label: `${g.name} (${g.code} v${g.version})` })), help: "Existing results keep the scale version they were graded with." },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: row ? row.is_active : true },
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title={isNew ? "New exam" : `Edit exam ${row?.code}`} />
      <Card>
        <CardContent>
          <EntityForm action={saveExam.bind(null, isNew ? null : id)} fields={fields} cancelHref="/admin/exams" />
        </CardContent>
      </Card>
    </div>
  );
}
