import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS, USER_MANAGERS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { supabase, profile } = await requireRole(USER_MANAGERS);
  const sp = await searchParams;
  // RLS scopes the list: central roles see everyone, institute admins their own institute.
  const { data: users } = await supabase.from("profiles").select("id, email, full_name, role, is_active, created_at, institute_id, institutes(code)").order("role").order("email");
  const manageable = (role: string, instituteId: string | null) =>
    profile.role === "super_admin" ||
    (profile.role === "central_admin" && role.startsWith("institute_")) ||
    (profile.role === "institute_admin" && role === "institute_staff" && instituteId === profile.institute_id);
  return (
    <div>
      <PageHeader
        title="Users"
        description={profile.role === "institute_admin" ? "Staff accounts of your institute." : "Staff accounts. Public sign-up is disabled; accounts are created here."}
        action={{ href: "/admin/users/new", label: profile.role === "institute_admin" ? "New staff account" : "New user" }}
      />
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
                    {manageable(u.role, u.institute_id) && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${u.id}`}>Edit</Link>
                      </Button>
                    )}
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
