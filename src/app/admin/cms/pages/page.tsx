import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { SavedAlert } from "@/components/admin/saved-alert";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { deletePage } from "../actions";

export const metadata = { title: "Pages & SEO" };

const ROUTES: Record<string, string> = { home: "/", about: "/about", courses: "/courses", notices: "/notices", contact: "/contact", institutes: "/institutes", results: "/results", verify: "/verify" };

export default async function PagesPage({ searchParams }: PageProps<"/admin/cms/pages">) {
  const { supabase } = await requireRole(CMS_EDITORS);
  const sp = await searchParams;
  const { data: pages } = await supabase.from("pages").select("id, slug, title_en, title_bn, is_system, is_published, updated_at").order("is_system", { ascending: false }).order("slug");
  return (
    <div>
      <PageHeader title="Pages & SEO" description="Edit the text and search-engine metadata of every public page, or add custom pages." action={{ href: "/admin/cms/pages/new", label: "New page" }} />
      <SavedAlert show={sp.saved} text="Page saved." />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages?.map((p) => {
                const href = ROUTES[p.slug] ?? `/p/${p.slug}`;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.title_en}</div>
                      <div className="text-xs text-muted-foreground">{p.title_bn}</div>
                    </TableCell>
                    <TableCell>
                      <a className="font-mono text-xs text-primary hover:underline" href={href} target="_blank">
                        {href}
                      </a>
                    </TableCell>
                    <TableCell>{p.is_system ? <Badge variant="secondary">built-in</Badge> : <Badge variant="outline">custom</Badge>}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.is_published ? "published" : "draft"} />
                    </TableCell>
                    <TableCell>{formatDateTime(p.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/cms/pages/${p.id}`}>Edit</Link>
                        </Button>
                        {!p.is_system && <ActionButton action={deletePage.bind(null, p.id)} label="Delete" variant="destructive" confirm={`Delete page ${p.slug}?`} />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
