import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyRow } from "@/components/admin/empty-row";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { deleteMenuItem } from "../actions";

export const metadata = { title: "Menus" };

export default async function MenusPage({ searchParams }: PageProps<"/admin/cms/menus">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const sp = await searchParams;
  const { data: items } = await supabase.from("menu_items").select("*").order("location").order("sort_order");
  return (
    <div className="space-y-6">
      <PageHeader title="Menus" description="Navigation links in the website header and footer." action={{ href: "/admin/cms/menus/new", label: "New menu item" }} />
      <SavedAlert show={sp.saved} text="Menu item saved." />
      {(["header", "footer"] as const).map((loc) => (
        <Card key={loc}>
          <CardHeader>
            <CardTitle className="capitalize">{loc} menu</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!items?.some((i) => i.location === loc) && <EmptyRow colSpan={5} />}
                {items
                  ?.filter((i) => i.location === loc)
                  .map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.sort_order}</TableCell>
                      <TableCell>
                        {i.label_en} <span className="text-muted-foreground">/ {i.label_bn}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.href}</TableCell>
                      <TableCell>
                        <StatusBadge status={i.is_active ? "active" : "inactive"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/cms/menus/${i.id}`}>Edit</Link>
                          </Button>
                          <ActionButton action={deleteMenuItem.bind(null, i.id)} label="Delete" variant="destructive" confirm="Delete this menu item?" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
