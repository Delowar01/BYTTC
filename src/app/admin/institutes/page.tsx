import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { CENTRAL } from "@/lib/roles";
import { escapeLike, formatDate, pageRange } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

export const metadata = { title: "Institutes" };
const STATUSES = ["pending", "approved", "rejected", "suspended"] as const;

export default async function InstitutesPage({ searchParams }: PageProps<"/admin/institutes">) {
  const { supabase } = await requireRole(CENTRAL);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";
  const { from, to, page } = pageRange(Number(sp.page));

  let query = supabase.from("institutes").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (q) {
    const t = escapeLike(q);
    query = query.or(`code.ilike.%${t}%,name_en.ilike.%${t}%,name_bn.ilike.%${t}%,district.ilike.%${t}%`);
  }
  if (status) query = query.eq("status", status as Database["public"]["Enums"]["institute_status"]);
  const { data: institutes, count } = await query;

  return (
    <div>
      <PageHeader title="Institutes" description="Partner institutes and their approval status. Only approved institutes appear on the public directory." action={{ href: "/admin/institutes/new", label: "New institute" }} />
      <Card>
        <CardContent>
          <form className="mb-4 flex flex-wrap gap-2">
            <Input name="q" defaultValue={q} placeholder="Search code, name or district" className="max-w-xs" />
            <NativeSelect name="status" defaultValue={status} className="w-40">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" type="submit">Filter</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Head</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!institutes?.length && <EmptyRow colSpan={7} />}
              {institutes?.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono">{i.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{i.name_en}</div>
                    <div className="text-xs text-muted-foreground">{i.name_bn}</div>
                  </TableCell>
                  <TableCell>{i.district ?? "—"}</TableCell>
                  <TableCell>{i.head_name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                  <TableCell>{formatDate(i.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/institutes/${i.id}`}>Manage</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/admin/institutes" params={{ q, status }} />
        </CardContent>
      </Card>
    </div>
  );
}
