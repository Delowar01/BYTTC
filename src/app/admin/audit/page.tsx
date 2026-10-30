import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { requireRole } from "@/lib/auth";
import { PUBLISHERS } from "@/lib/roles";
import { formatDateTime, pageRange } from "@/lib/utils";

export const metadata = { title: "Audit log" };
const TABLES = ["results", "students", "institutes", "import_batches", "courses", "exams", "academic_sessions", "grade_rules", "certificates", "profiles", "site_settings", "pages", "banners", "menu_items", "notices"];

function summarize(oldData: unknown, newData: unknown) {
  const o = (oldData ?? {}) as Record<string, unknown>;
  const n = (newData ?? {}) as Record<string, unknown>;
  if (!oldData) return Object.entries(n).filter(([k]) => !["id", "created_at", "updated_at", "payload", "errors"].includes(k)).slice(0, 4).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
  return Object.keys(n)
    .filter((k) => !["updated_at", "updated_by"].includes(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    .map((k) => `${k}: ${JSON.stringify(o[k])} → ${JSON.stringify(n[k])}`)
    .join("; ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const { supabase } = await requireRole(PUBLISHERS);
  const sp = await searchParams;
  const table = typeof sp.table === "string" && TABLES.includes(sp.table) ? sp.table : "";
  const record = typeof sp.record === "string" ? sp.record.trim() : "";
  const { from, to, page } = pageRange(Number(sp.page), 50);
  let q = supabase.from("audit_logs").select("*", { count: "exact" }).order("occurred_at", { ascending: false }).range(from, to);
  if (table) q = q.eq("table_name", table);
  if (record) q = q.eq("record_id", record);
  const { data: logs, count } = await q;
  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter((v): v is string => !!v))];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, email").in("id", actorIds) : { data: [] };
  const emailOf = new Map((actors ?? []).map((a) => [a.id, a.email]));

  return (
    <div>
      <PageHeader title="Audit log" description="Append-only record of every change and privileged action. Personal ID numbers are redacted." />
      <Card>
        <CardContent>
          <form className="mb-4 flex flex-wrap gap-2">
            <NativeSelect name="table" defaultValue={table} className="w-48" aria-label="Table">
              <option value="">All tables</option>
              {TABLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
            <Input name="record" defaultValue={record} placeholder="Record ID" className="max-w-xs" />
            <Button variant="outline" type="submit">Filter</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs?.length && <EmptyRow colSpan={6} />}
              {logs?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{formatDateTime(l.occurred_at)}</TableCell>
                  <TableCell className="text-xs">{l.actor_id ? (emailOf.get(l.actor_id) ?? l.actor_id.slice(0, 8)) : "system"}</TableCell>
                  <TableCell className="text-xs font-medium">{l.action}</TableCell>
                  <TableCell className="text-xs">{l.table_name}</TableCell>
                  <TableCell className="max-w-xl truncate font-mono text-[11px]" title={summarize(l.old_data, l.new_data)}>
                    {summarize(l.old_data, l.new_data)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs">{l.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/admin/audit" params={{ table, record }} size={50} />
        </CardContent>
      </Card>
    </div>
  );
}
