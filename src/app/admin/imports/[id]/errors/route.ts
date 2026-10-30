import { CSV_TYPE, fileResponse, routeSession } from "@/lib/http";
import { toCsv } from "@/lib/import/spreadsheet";
import type { ImportIssue } from "@/lib/import/results";
import { ALL_STAFF } from "@/lib/roles";

export async function GET(_request: Request, ctx: RouteContext<"/admin/imports/[id]/errors">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const { data: batch } = await session.supabase.from("import_batches").select("errors, file_name").eq("id", id).maybeSingle();
  if (!batch) return Response.json({ error: "Not found" }, { status: 404 });
  const issues = ((batch.errors as ImportIssue[]) ?? []).slice().sort((a, b) => a.row - b.row);
  const csv = toCsv(["row", "level", "column", "value", "message"], issues.map((i) => [i.row, i.level, i.column ?? "", i.value ?? "", i.message]));
  return fileResponse(csv, `errors-${batch.file_name.replace(/\.[^.]+$/, "")}.csv`, CSV_TYPE);
}
