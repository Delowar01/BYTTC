import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { requireRole } from "@/lib/auth";
import { PUBLISHERS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { saveScale } from "./actions";
import { ScaleEditor } from "./scale-editor";

export const metadata = { title: "Grading scales" };
type Rule = { min_percent: number; grade: string; point: number };

export default async function GradingPage() {
  const { supabase } = await requireRole(PUBLISHERS);
  const { data: scales } = await supabase.from("grade_scales").select("*").order("code").order("version", { ascending: false });
  const current = (scales ?? []).filter((s) => s.is_current);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Grading scales"
        description="Percentage-to-grade rules per scale (e.g. GPA 5.00 or CGPA 4.00). Each exam chooses a scale. Saving creates a new version: results already graded keep the version they used."
      />
      {current.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {s.name} <Badge variant="secondary">{s.code}</Badge> <Badge variant="outline">version {s.version}</Badge>
            </CardTitle>
            <CardDescription>Updated {formatDateTime(s.created_at)}. Below the exam&apos;s pass mark a student always gets the lowest grade.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScaleEditor action={saveScale} lockCode initial={{ code: s.code, name: s.name, max_point: Number(s.max_point), rules: (s.rules as Rule[]).map((r) => ({ ...r, point: Number(r.point) })) }} />
            {(scales ?? []).some((o) => o.code === s.code && !o.is_current) && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Previous versions</summary>
                <ul className="mt-2 space-y-1">
                  {(scales ?? [])
                    .filter((o) => o.code === s.code && !o.is_current)
                    .map((o) => (
                      <li key={o.id}>
                        v{o.version} · {formatDateTime(o.created_at)} · {(o.rules as Rule[]).map((r) => `${r.min_percent}%→${r.grade} (${r.point})`).join(", ")}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>New scale</CardTitle>
          <CardDescription>For course- or exam-specific grading. Select it on the exam.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScaleEditor action={saveScale} initial={{ code: "", name: "", max_point: 4, rules: [{ min_percent: 80, grade: "A+", point: 4 }, { min_percent: 0, grade: "F", point: 0 }] }} />
        </CardContent>
      </Card>
    </div>
  );
}
