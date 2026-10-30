import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Hashed client IP (Vercel sets x-forwarded-for); raw IPs are never stored. */
export async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`ttims:${ip}`).digest("hex").slice(0, 32);
}

/** Returns false when this client exceeded `max` requests of `kind` within the window. */
export async function allowRequest(kind: string, max: number, window: string) {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_client_key: await clientKey(),
    p_kind: kind,
    p_max: max,
    p_window: window,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
