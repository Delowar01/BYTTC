import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS, SUPER } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { supabase } = await requireRole(SUPER);
  const sp = await searchParams;
  const { data: users } = await supabase.from("profiles").select("id, email, full_name, role, is_active, created_at, institutes(code)").order("role").order("email");
  return (
    <div>
      <PageHeader title="Users" description="Staff accounts. Public sign-up is disabled; only a Super Admin can create accounts." action={{ href: "/admin/users/new", label: "New user" }} />
      <SavedAlert show={sp.saved} text="User created." />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Institute</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>{u.institutes?.code ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>{formatDateTime(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/users/${u.id}`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
