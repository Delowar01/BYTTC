import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { deleteBanner } from "../actions";

export const metadata = { title: "Banners" };

export default async function BannersPage({ searchParams }: PageProps<"/admin/cms/banners">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const sp = await searchParams;
  const { data: banners } = await supabase.from("banners").select("*").order("sort_order");
  return (
    <div>
      <PageHeader title="Home page banners" description="Slides shown at the top of the home page, in sort order." action={{ href: "/admin/cms/banners/new", label: "New banner" }} />
      <SavedAlert show={sp.saved} text="Banner saved." />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!banners?.length && <EmptyRow colSpan={6} />}
              {banners?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    {b.image_url ? <img src={b.image_url} alt="" className="h-10 w-16 rounded object-cover" /> : <span className="text-xs text-muted-foreground">none</span>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{b.title_en}</div>
                    <div className="text-xs text-muted-foreground">{b.title_bn}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{b.link_url}</TableCell>
                  <TableCell>{b.sort_order}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/cms/banners/${b.id}`}>Edit</Link>
                      </Button>
                      <ActionButton action={deleteBanner.bind(null, b.id)} label="Delete" variant="destructive" confirm="Delete this banner?" />
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
