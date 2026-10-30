import type { NextRequest } from "next/server";
import { routeSession } from "@/lib/http";
import { CENTRAL } from "@/lib/roles";

/** Short-lived signed link to a private application document (central staff only). */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/institutes/[id]/document">) {
  const session = await routeSession(CENTRAL);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const { data: inst } = await session.supabase.from("institutes").select("documents").eq("id", id).maybeSingle();
  // Only paths recorded on this institute can be requested.
  if (!inst || !inst.documents.includes(path)) return Response.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await session.supabase.storage.from("private-documents").createSignedUrl(path, 60);
  if (error || !data) return Response.json({ error: "Not found" }, { status: 404 });
  await session.supabase.rpc("log_event", { p_action: "document.view", p_table: "institutes", p_record_id: id, p_data: { path } });
  return Response.redirect(data.signedUrl, 302);
}
