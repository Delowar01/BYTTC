import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/roles";
import { formatDateTime, pageRange } from "@/lib/utils";

export const metadata = { title: "Import history" };

export default async function ImportsPage({ searchParams }: PageProps<"/admin/imports">) {
  const { supabase } = await requireRole(ALL_STAFF);
  const sp = await searchParams;
  const kind = sp.kind === "results" || sp.kind === "students" ? sp.kind : "";
  const { from, to, page } = pageRange(Number(sp.page));
  let q = supabase
    .from("import_batches")
    .select("id, kind, file_name, status, total_rows, valid_rows, error_rows, created_at, committed_at, published_at, created_by, institutes(code)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (kind) q = q.eq("kind", kind);
  const { data: batches, count, error } = await q;
  const creatorIds = [...new Set((batches ?? []).map((b) => b.created_by).filter((v): v is string => !!v))];
  const { data: creators } = creatorIds.length ? await supabase.from("profiles").select("id, email").in("id", creatorIds) : { data: [] };
  const emailOf = new Map((creators ?? []).map((p) => [p.id, p.email]));

  return (
    <div>
      <PageHeader title="Import history" description="Every uploaded file is kept with its validation report, status history and original file." action={{ href: "/admin/results/import", label: "Upload results" }} />
      {error && <p className="mb-4 text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <form className="mb-4 flex gap-2">
            <NativeSelect name="kind" defaultValue={kind} className="w-44" aria-label="Type">
              <option value="">All types</option>
              <option value="results">Results</option>
              <option value="students">Students</option>
            </NativeSelect>
            <Button variant="outline" type="submit">Filter</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rows (valid / errors)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!batches?.length && <EmptyRow colSpan={6} text="No imports yet." />}
              {batches?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link className="text-primary hover:underline" href={`/admin/imports/${b.id}`}>
                      {b.file_name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{b.kind}</TableCell>
                  <TableCell>
                    {b.total_rows} ({b.valid_rows} / <span className={b.error_rows ? "text-destructive" : ""}>{b.error_rows}</span>)
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell>
                    {(b.created_by && emailOf.get(b.created_by)) ?? "—"}
                    {b.institutes?.code && <span className="text-muted-foreground"> ({b.institutes.code})</span>}
                  </TableCell>
                  <TableCell>{formatDateTime(b.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/admin/imports" params={{ kind }} />
        </CardContent>
      </Card>
    </div>
  );
}
