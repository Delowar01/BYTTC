import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { MediaUpload } from "@/components/admin/media-upload";
import { requireRole } from "@/lib/auth";
import { CMS_EDITORS } from "@/lib/roles";
import { deleteMedia, uploadMedia } from "../actions";

export const metadata = { title: "Media library" };
const FOLDERS = ["library", "banners", "courses", "notices", "pages", "branding"];

export default async function MediaPage() {
  const { supabase } = await requireRole(CMS_EDITORS);
  const lists = await Promise.all(
    FOLDERS.map(async (folder) => {
      const { data } = await supabase.storage.from("public-media").list(folder, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      return (data ?? []).filter((f) => f.id).map((f) => ({ ...f, path: `${folder}/${f.name}` }));
    }),
  );
  const files = lists.flat();
  return (
    <div className="space-y-6">
      <PageHeader title="Media library" description="Public images and PDFs for pages, banners and notices. Copy a file's URL into any image field." />
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>PNG, JPEG, WebP, GIF, SVG or PDF up to 5 MB each. Files here are publicly accessible — never upload personal documents.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaUpload action={uploadMedia} />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {files.length === 0 && <p className="text-sm text-muted-foreground">No files yet.</p>}
        {files.map((f) => {
          const url = supabase.storage.from("public-media").getPublicUrl(f.path).data.publicUrl;
          const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);
          return (
            <Card key={f.path} className="gap-3 py-3">
              <CardContent className="space-y-2 px-3">
                {isImage ? (
                  <img src={url} alt={f.name} className="h-32 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded bg-muted text-sm">PDF</div>
                )}
                <p className="truncate text-xs" title={f.path}>{f.path}</p>
                <input readOnly value={url} className="w-full rounded border bg-muted px-2 py-1 font-mono text-[10px]" aria-label="Public URL" />
                <ActionButton action={deleteMedia.bind(null, f.path)} label="Delete" variant="destructive" confirm="Delete this file? Pages using it will show a broken image." />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
