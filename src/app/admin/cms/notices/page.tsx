import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { deleteNotice } from "../actions";

export const metadata = { title: "Notices" };

export default async function NoticesPage({ searchParams }: PageProps<"/admin/cms/notices">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const sp = await searchParams;
  const { data: notices } = await supabase.from("notices").select("*").order("published_at", { ascending: false });
  return (
    <div>
      <PageHeader title="Notices" description="Announcements on the public notice board. Future publish dates are scheduled." action={{ href: "/admin/cms/notices/new", label: "New notice" }} />
      <SavedAlert show={sp.saved} text="Notice saved." />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Publish date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!notices?.length && <EmptyRow colSpan={4} />}
              {notices?.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="max-w-md whitespace-normal">
                    <div className="font-medium">
                      {n.title_en} {n.is_pinned && <Badge variant="warning">pinned</Badge>} {n.attachment_url && <Badge variant="outline">attachment</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{n.title_bn}</div>
                  </TableCell>
                  <TableCell>{formatDateTime(n.published_at)}</TableCell>
                  <TableCell>
                    <StatusBadge status={n.is_published ? "published" : "draft"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/cms/notices/${n.id}`}>Edit</Link>
                      </Button>
                      <ActionButton action={deleteNotice.bind(null, n.id)} label="Delete" variant="destructive" confirm="Delete this notice?" />
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
