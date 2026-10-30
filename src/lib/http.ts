import "server-only";
import { assertRole, AuthError, type Session } from "@/lib/auth";
import type { AppRole } from "@/lib/roles";

/** Route-handler guard: 401/403 JSON instead of redirects. */
export async function routeSession(roles: AppRole[]): Promise<Session | Response> {
  try {
    return await assertRole(roles);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.message.includes("signed in") ? 401 : 403 });
    throw e;
  }
}

export function fileResponse(body: Buffer | string, filename: string, type: string) {
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_TYPE = "text/csv; charset=utf-8";
