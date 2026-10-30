import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireRole } from "@/lib/auth";
import { CENTRAL, PUBLISHERS } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { deleteSession } from "./actions";

export const metadata = { title: "Academic sessions" };

export default async function SessionsPage({ searchParams }: PageProps<"/admin/sessions">) {
  const { supabase, profile } = await requireRole(CENTRAL);
  const sp = await searchParams;
  const { data: sessions } = await supabase.from("academic_sessions").select("*").order("start_date", { ascending: false });
  const canDelete = PUBLISHERS.includes(profile.role);
  return (
    <div>
      <PageHeader title="Academic sessions" description="Enrolment periods used for students and exams." action={{ href: "/admin/sessions/new", label: "New session" }} />
      {sp.saved && (
        <Alert variant="success" className="mb-4">
          <AlertDescription className="text-inherit">Session saved.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!sessions?.length && <EmptyRow colSpan={5} />}
              {sessions?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{formatDate(s.start_date)}</TableCell>
                  <TableCell>{formatDate(s.end_date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={s.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/sessions/${s.id}`}>Edit</Link>
                      </Button>
                      {canDelete && (
                        <ActionButton action={deleteSession.bind(null, s.id)} label="Delete" variant="destructive" confirm={`Delete session ${s.name}?`} />
                      )}
                    </div>
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
