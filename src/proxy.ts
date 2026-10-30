import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, isFileRoute } from "@/lib/csp";
import { updateSession } from "@/lib/supabase/proxy";

/** Paths where the Supabase session must be refreshed (and /admin guarded). */
function needsSession(pathname: string) {
  return pathname.startsWith("/admin") || pathname === "/login" || pathname === "/reset-password" || pathname.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let csp: string | null = null;
  if (!isFileRoute(pathname)) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = buildCsp(nonce);
    // Next.js reads the nonce from the request's CSP header while rendering.
    request.headers.set("x-nonce", nonce);
    request.headers.set("Content-Security-Policy", csp);
  }
  const response = needsSession(pathname) ? await updateSession(request) : NextResponse.next({ request });
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
