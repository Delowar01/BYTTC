import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/i18n";

/** /lang?to=en&next=/courses — switch language and return to the page. */
export function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to") === "en" ? "en" : "bn";
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const response = NextResponse.redirect(new URL(safeNext, request.url));
  response.cookies.set(LOCALE_COOKIE, to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
