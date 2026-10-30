import Link from "next/link";
import { Download, FileDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/roles";
import { escapeLike, pageRange } from "@/lib/utils";

export const metadata = { title: "Marksheets" };
const BULK_PART = 50;

/** Marksheets are generated on demand from published results with the active marksheet template. */
export default async function MarksheetsPage({ searchParams }: PageProps<"/admin/marksheets">) {
  const { supabase } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const exam = typeof sp.exam === "string" ? sp.exam : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const { from, to, page } = pageRange(Number(sp.page));

  let query = supabase
    .from("results")
    .select("id, grade, grade_point, version, display_published_on, students!inner(roll_no, name_en, registration_no), exams(code, name)", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to);
  if (exam) query = query.eq("exam_id", exam);
  if (q) {
    const t = escapeLike(q);
    query = query.or(`roll_no.ilike.%${t}%,name_en.ilike.%${t}%,registration_no.ilike.%${t}%`, { referencedTable: "students" });
  }
  const [{ data: rows, count, error }, { data: exams }, { data: template }, published] = await Promise.all([
    query,
    supabase.from("exams").select("id, code, name").order("code"),
    supabase.from("document_templates").select("name, version").eq("doc_type", "marksheet").eq("status", "active").maybeSingle(),
    exam ? supabase.from("results").select("id", { count: "exact", head: true }).eq("exam_id", exam).eq("status", "published") : Promise.resolve({ count: 0 }),
  ]);
  const total = published.count ?? 0;
  const parts = Math.ceil(total / BULK_PART);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marksheets"
        description={`Result sheets for published results, generated on demand with ${template ? `the template “${template.name}” v${template.version}` : "the built-in layout"}. Each sheet carries a QR code for verification; a later correction makes older printouts verify as superseded.`}
      />
      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap gap-2">
            <NativeSelect name="exam" defaultValue={exam} className="max-w-md" aria-label="Exam">
              <option value="">All exams</option>
              {exams?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </NativeSelect>
            <Input name="q" defaultValue={q} placeholder="Roll, registration or name" className="max-w-xs" />
            <Button variant="outline" type="submit">
              Filter
            </Button>
          </form>
          {exam && (
            <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="bulk-marksheets">
              <span className="text-muted-foreground">{total} published result(s).</span>
              {Array.from({ length: parts }, (_, i) => (
                <Button key={i} variant="outline" size="sm" asChild>
                  <a href={`/admin/results/marksheets?exam=${exam}&part=${i + 1}`}>
                    <Download /> Marksheets{parts > 1 ? ` ${i * BULK_PART + 1}–${Math.min((i + 1) * BULK_PART, total)}` : ""}
                  </a>
                </Button>
              ))}
            </div>
          )}
          {error && <p className="text-destructive">{error.message}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Marksheet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!rows?.length && <EmptyRow colSpan={5} text="No published results." />}
              {rows?.map((r) => {
                const s = r.students as { roll_no: string; name_en: string } | null;
                const e = r.exams as { code: string } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/admin/results/${r.id}`} className="hover:underline">
                        {s?.name_en}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">{s?.roll_no}</div>
                    </TableCell>
                    <TableCell className="text-xs">{e?.code}</TableCell>
                    <TableCell>
                      {r.grade} ({Number(r.grade_point).toFixed(2)})
                    </TableCell>
                    <TableCell>v{r.version}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/admin/results/${r.id}/marksheet`} target="_blank" rel="noopener">
                          <FileDown /> PDF
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/admin/marksheets" params={{ exam, q }} />
        </CardContent>
      </Card>
    </div>
  );
}
