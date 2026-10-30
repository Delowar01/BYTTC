import { routeSession } from "@/lib/http";
import { ALL_STAFF } from "@/lib/roles";

/** Short-lived signed link to the original upload (private bucket, RLS-checked). */
export async function GET(_request: Request, ctx: RouteContext<"/admin/imports/[id]/file">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const { data: batch } = await session.supabase.from("import_batches").select("file_path, file_name").eq("id", id).maybeSingle();
  if (!batch?.file_path) return Response.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await session.supabase.storage
    .from("private-documents")
    .createSignedUrl(batch.file_path, 60, { download: batch.file_name });
  if (error || !data) return Response.json({ error: error?.message ?? "Not found" }, { status: 404 });
  return Response.redirect(data.signedUrl, 302);
}
