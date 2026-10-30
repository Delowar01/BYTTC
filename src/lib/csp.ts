/**
 * Content Security Policy with a per-request nonce (Next.js applies it to its
 * own scripts automatically). Styles allow 'unsafe-inline' because component
 * libraries set style attributes, which nonces cannot cover.
 */
export function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // CMS images may come from the media library (Supabase Storage) or any https URL.
    `img-src 'self' data: blob: https: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    // Optional Google Maps embed on the contact page.
    "frame-src https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Route handlers that return files (PDF, Excel, CSV, redirects to signed URLs) — not HTML. */
export function isFileRoute(pathname: string) {
  return /\/(pdf|export|template|file|document|errors|marksheet|marksheets|sheet|preview)$/.test(pathname) || pathname === "/lang";
}
