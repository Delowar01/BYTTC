import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { UploadForm } from "@/components/admin/upload-form";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/roles";
import { uploadStudents } from "./actions";

export const metadata = { title: "Import students" };

export default async function StudentImportPage() {
  await requireRole(ALL_STAFF);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Import students" description="Register many students at once from Excel (.xlsx) or CSV." />
      <Card>
        <CardHeader>
          <CardTitle>1. Download the template</CardTitle>
          <CardDescription>Blank roll and registration numbers are generated automatically.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/admin/students/template?format=xlsx">
              <Download /> Excel template (.xlsx)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/admin/students/template?format=csv">
              <Download /> CSV template
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. Upload and validate</CardTitle>
          <CardDescription>All rows are validated and previewed. Students are created only when you commit.</CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm action={uploadStudents} />
        </CardContent>
      </Card>
    </div>
  );
}
