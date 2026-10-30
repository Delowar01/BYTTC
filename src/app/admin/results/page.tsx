import Link from "next/link";
import { Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, isCentral, PUBLISHERS } from "@/lib/roles";
import { escapeLike, pageRange } from "@/lib/utils";
import type { Database } from "@/lib/database.types";
import { publishSelected } from "./actions";

export const metadata = { title: "Results" };
const STATUSES = ["draft", "submitted", "published", "unpublished"] as const;
type ResultStatus = Database["public"]["Enums"]["result_status"];

export default async function ResultsPage({ searchParams }: PageProps<"/admin/results">) {
  const { supabase, profile } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = { exam: s("exam"), institute: s("institute"), status: (STATUSES as readonly string[]).includes(s("status")) ? s("status") : "", batch: s("batch"), q: s("q") };
  const { from, to, page } = pageRange(Number(sp.page));
  const canPublish = PUBLISHERS.includes(profile.role);

  let query = supabase
    .from("results")
    .select("id, theory_marks, practical_marks, total_marks, percentage, grade, grade_point, is_pass, status, version, updated_at, students!inner(roll_no, registration_no, name_en), exams(code), institutes(code)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (f.exam) query = query.eq("exam_id", f.exam);
  if (f.institute) query = query.eq("institute_id", f.institute);
  if (f.status) query = query.eq("status", f.status as ResultStatus);
  if (f.batch) query = query.eq("batch_id", f.batch);
  if (f.q) {
    const t = escapeLike(f.q);
    query = query.or(`roll_no.ilike.%${t}%,registration_no.ilike.%${t}%,name_en.ilike.%${t}%`, { referencedTable: "students" });
  }

  const [{ data: results, count, error }, { data: exams }, { data: institutes }] = await Promise.all([
    query,
    supabase.from("exams").select("id, code").order("code"),
    supabase.from("institutes").select("id, code").order("code"),
  ]);
  const backQs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <PageHeader title="Results" description="Review, correct and publish results. Imported results stay in draft until published.">
        <Button asChild>
          <Link href="/admin/results/import">
            <Upload /> Bulk upload
          </Link>
        </Button>
      </PageHeader>
      {s("msg") && (
        <Alert variant={s("msg").startsWith("Error") ? "destructive" : "success"} className="mb-4">
          <AlertDescription className="text-inherit">{s("msg")}</AlertDescription>
        </Alert>
      )}
      {error && <p className="mb-4 text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input name="q" defaultValue={f.q} placeholder="Roll, registration or name" />
            <NativeSelect name="exam" defaultValue={f.exam} aria-label="Exam">
              <option value="">All exams</option>
              {exams?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code}
                </option>
              ))}
            </NativeSelect>
            {isCentral(profile.role) && (
              <NativeSelect name="institute" defaultValue={f.institute} aria-label="Institute">
                <option value="">All institutes</option>
                {institutes?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect name="status" defaultValue={f.status} aria-label="Status">
              <option value="">Any status</option>
              {STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </NativeSelect>
            <div className="flex gap-2">
              {f.batch && <input type="hidden" name="batch" value={f.batch} />}
              <Button variant="outline" type="submit">Filter</Button>
              {f.batch && (
                <Button variant="ghost" asChild>
                  <Link href="/admin/results">Clear batch</Link>
                </Button>
              )}
            </div>
          </form>
          <form action={publishSelected}>
            <input type="hidden" name="back" value={backQs} />
            {canPublish && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">With selected:</span>
                <Button size="sm" type="submit" name="op" value="publish">Publish</Button>
                <Button size="sm" variant="outline" type="submit" name="op" value="unpublish">Unpublish</Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  {canPublish && <TableHead className="w-8"><span className="sr-only">Select</span></TableHead>}
                  <TableHead>Roll</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Institute</TableHead>
                  <TableHead>Theory</TableHead>
                  <TableHead>Practical</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!results?.length && <EmptyRow colSpan={canPublish ? 11 : 10} />}
                {results?.map((r) => (
                  <TableRow key={r.id}>
                    {canPublish && (
                      <TableCell>
                        <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.students.roll_no}`} className="size-4" />
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{r.students.roll_no}</TableCell>
                    <TableCell>{r.students.name_en}</TableCell>
                    <TableCell className="font-mono text-xs">{r.exams?.code}</TableCell>
                    <TableCell>{r.institutes?.code}</TableCell>
                    <TableCell>{r.theory_marks ?? "—"}</TableCell>
                    <TableCell>{r.practical_marks ?? "—"}</TableCell>
                    <TableCell>{r.total_marks}</TableCell>
                    <TableCell className={r.is_pass ? "" : "text-destructive"}>
                      {r.grade} ({Number(r.grade_point).toFixed(2)})
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.version > 1 && <span className="ml-1 text-xs text-muted-foreground">v{r.version}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link className="text-primary hover:underline" href={`/admin/results/${r.id}`}>
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </form>
          <Pagination page={page} total={count ?? 0} basePath="/admin/results" params={f} />
        </CardContent>
      </Card>
    </div>
  );
}
