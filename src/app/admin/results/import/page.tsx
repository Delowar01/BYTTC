import Link from "next/link";
import { Download, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { UploadForm } from "@/components/admin/upload-form";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/roles";
import { uploadResults } from "./actions";

export const metadata = { title: "Bulk result upload" };

export default async function ResultImportPage() {
  await requireRole(ALL_STAFF);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Bulk result upload" description="Upload marks for many students at once from Excel (.xlsx) or CSV.">
        <Button variant="outline" asChild>
          <Link href="/admin/imports">
            <History /> Import history
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>1. Download the template</CardTitle>
          <CardDescription>The Excel template also lists the current exam and institute codes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/admin/results/template?format=xlsx">
              <Download /> Excel template (.xlsx)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/admin/results/template?format=csv">
              <Download /> CSV template
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. Upload and validate</CardTitle>
          <CardDescription>
            Every row is checked: file type and size, required columns, student roll and registration, institute,
            course, exam, duplicates and marks ranges. You will see every error before anything is saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm action={uploadResults} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>3. Commit, then publish</CardTitle>
          <CardDescription>
            Committing saves the results as <strong>drafts</strong> in a single transaction. Results are never
            published automatically: an authorized central administrator must publish the batch. Committed batches
            can be rolled back until they are published.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
