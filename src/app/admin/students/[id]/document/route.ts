import type { NextRequest } from "next/server";
import { routeSession } from "@/lib/http";
import { ALL_STAFF } from "@/lib/roles";

/** 60-second signed link to a student's private document (RLS-checked, logged). */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/students/[id]/document">) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const name = request.nextUrl.searchParams.get("name") ?? "";
  const { data: student } = await session.supabase.from("students").select("institute_id").eq("id", id).maybeSingle();
  if (!student || !name || name.includes("/")) return Response.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await session.supabase.storage.from("private-documents").createSignedUrl(`institutes/${student.institute_id}/students/${id}/${name}`, 60, { download: name });
  if (error || !data) return Response.json({ error: "Not found" }, { status: 404 });
  await session.supabase.rpc("log_event", { p_action: "document.view", p_table: "students", p_record_id: id, p_data: { name } });
  return Response.redirect(data.signedUrl, 302);
}
