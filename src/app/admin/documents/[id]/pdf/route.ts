import { routeSession } from "@/lib/http";
import { renderIssued } from "@/lib/documents/issued";
import { documentState } from "@/lib/documents/state";
import { pdfResponse } from "@/lib/pdf-response";
import { ALL_STAFF } from "@/lib/roles";

/** One admit/registration card from its snapshot (RLS: institutes see their own). Invalid cards are stamped. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/documents/[id]/pdf">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const { data: d } = await session.supabase
    .from("documents")
    .select("doc_type, document_no, status, valid_until, revoke_reason, layout, background_path, background_type, data")
    .eq("id", id)
    .maybeSingle();
  if (!d) return Response.json({ error: "Not found" }, { status: 404 });
  const state = documentState(d);
  const bytes = await renderIssued(
    session.supabase,
    session.supabase,
    [{ number: d.document_no, layout: d.layout, background_path: d.background_path, background_type: d.background_type, data: d.data, overlay: state === "valid" ? undefined : state.toUpperCase() }],
    d.doc_type === "admit_card" ? "Admit card" : "Registration card",
  );
  await session.supabase.rpc("log_event", { p_action: "document.download", p_table: "documents", p_record_id: id });
  return pdfResponse(bytes, `${d.doc_type.replace("_", "-")}-${d.document_no}.pdf`);
}
