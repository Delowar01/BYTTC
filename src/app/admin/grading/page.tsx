import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm } from "@/components/admin/entity-form";
import { ActionButton } from "@/components/admin/action-button";
import { requireRole } from "@/lib/auth";
import { PUBLISHERS } from "@/lib/roles";
import { deleteGradeRule, saveGradeRule } from "./actions";

export const metadata = { title: "Grading rules" };

export default async function GradingPage() {
  const { supabase } = await requireRole(PUBLISHERS);
  const { data: rules } = await supabase.from("grade_rules").select("*").order("min_percent", { ascending: false });
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Grading rules" description="Letter grade by percentage of total full marks. A student below the exam's pass marks always gets F (0.00)." />
      <Card>
        <CardHeader>
          <CardTitle>Current scale</CardTitle>
          <CardDescription>Grades are computed by the database whenever a result is saved. Changing the scale affects results saved afterwards; existing results keep their grade until corrected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules?.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <EntityForm
                  action={saveGradeRule.bind(null, r.id)}
                  submitLabel="Update"
                  fields={[
                    { name: "min_percent", label: "From %", type: "number", step: "0.01", required: true, defaultValue: r.min_percent },
                    { name: "grade", label: "Grade", required: true, defaultValue: r.grade },
                    { name: "grade_point", label: "Grade point", type: "number", step: "0.01", required: true, defaultValue: r.grade_point },
                  ]}
                />
              </div>
              <ActionButton action={deleteGradeRule.bind(null, r.id)} label="Delete" variant="destructive" confirm={`Delete grade ${r.grade}?`} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add a grade</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityForm
            action={saveGradeRule.bind(null, null)}
            submitLabel="Add"
            fields={[
              { name: "min_percent", label: "From %", type: "number", step: "0.01", required: true },
              { name: "grade", label: "Grade", required: true },
              { name: "grade_point", label: "Grade point", type: "number", step: "0.01", required: true },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
