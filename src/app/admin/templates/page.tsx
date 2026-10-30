import Link from "next/link";
import { Eye, FileDown, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyRow } from "@/components/admin/empty-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionButton } from "@/components/admin/action-button";
import { requireRole } from "@/lib/auth";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/documents/types";
import { PUBLISHERS } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { activateTemplate, archiveTemplate, createTemplate, deleteTemplate, duplicateTemplate } from "./actions";
import { NewTemplateForm } from "./new-template-form";

export const metadata = { title: "Document templates" };

const NO_ACTIVE: Record<DocType, string> = {
  certificate: "No active template: certificates use the built-in design.",
  marksheet: "No active template: marksheets use the built-in layout.",
  admit_card: "No active template: admit cards cannot be issued.",
  registration_card: "No active template: registration cards cannot be issued.",
};

export default async function TemplatesPage() {
  const { supabase } = await requireRole(PUBLISHERS);
  const { data: templates, error } = await supabase
    .from("document_templates")
    .select("id, doc_type, name, version, status, background_type, updated_at, activated_at")
    .order("doc_type")
    .order("status")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document templates"
        description="Upload a blank design (PNG, JPG or PDF) and place the data fields on it. Only drafts can be edited; activating a draft archives the previous version. Issued documents keep the design they were issued with."
      />
      <Card>
        <CardHeader>
          <CardTitle>New template</CardTitle>
          <CardDescription>Starts from the built-in layout of the chosen type. Use only designs you are authorized to use; do not upload completed documents containing personal data or real signatures as a design.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewTemplateForm action={createTemplate} types={Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        </CardContent>
      </Card>
      {error && <p className="text-destructive">{error.message}</p>}
      {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((type) => {
        const rows = templates?.filter((t) => t.doc_type === type) ?? [];
        const hasActive = rows.some((t) => t.status === "active");
        return (
          <Card key={type} data-testid={`templates-${type}`}>
            <CardHeader>
              <CardTitle>{DOC_TYPE_LABELS[type]}</CardTitle>
              {!hasActive && <CardDescription className="text-amber-700 dark:text-amber-400">{NO_ACTIVE[type]}</CardDescription>}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Design</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!rows.length && <EmptyRow colSpan={6} text="No templates." />}
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>v{t.version}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.background_type ? `Uploaded ${t.background_type.toUpperCase()}` : "Built-in frame"}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>{formatDate(t.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/templates/${t.id}`}>
                              {t.status === "draft" ? <Pencil /> : <Eye />} {t.status === "draft" ? "Edit" : "View"}
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/admin/templates/${t.id}/preview`} target="_blank" rel="noopener">
                              <FileDown /> Preview
                            </a>
                          </Button>
                          <ActionButton action={duplicateTemplate.bind(null, t.id)} label="Duplicate" />
                          {t.status !== "active" && (
                            <ActionButton action={activateTemplate.bind(null, t.id)} label="Activate" variant="default" confirm={`Activate “${t.name}” v${t.version}? It replaces the current ${DOC_TYPE_LABELS[type].toLowerCase()} template for new documents.`} />
                          )}
                          {t.status !== "archived" && (
                            <ActionButton
                              action={archiveTemplate.bind(null, t.id)}
                              label="Archive"
                              confirm={t.status === "active" ? `Archive the ACTIVE template? ${NO_ACTIVE[type]}` : "Archive this draft?"}
                            />
                          )}
                          {t.status === "draft" && <ActionButton action={deleteTemplate.bind(null, t.id)} label="Delete" variant="destructive" confirm="Delete this draft permanently?" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
