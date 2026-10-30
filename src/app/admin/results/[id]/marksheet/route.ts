import { routeSession } from "@/lib/http";
import { factsFromRow, MARKSHEET_SELECT, renderMarksheets } from "@/lib/documents/marksheet";
import { pdfResponse } from "@/lib/pdf-response";
import { ALL_STAFF } from "@/lib/roles";

/** Staff marksheet for one result (RLS: institutes only their own). Unpublished results are stamped. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/results/[id]/marksheet">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const { data: row } = await session.supabase.from("results").select(MARKSHEET_SELECT).eq("id", id).maybeSingle();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const r = row as unknown as Parameters<typeof factsFromRow>[0] & { status: string };
  const facts = { ...factsFromRow(r), overlay: r.status === "published" ? undefined : r.status.toUpperCase() };
  const bytes = await renderMarksheets(session.supabase, [facts], session.supabase);
  await session.supabase.rpc("log_event", { p_action: "marksheet.download", p_table: "results", p_record_id: id });
  return pdfResponse(bytes, `marksheet-${facts.roll_no}-${facts.exam_code}.pdf`);
}
