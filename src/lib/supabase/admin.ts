import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. SERVER ONLY and used for a narrow set of operations:
 * creating auth users, and the rate-limited public lookups. Never pass its
 * results to the client without selecting public fields first.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
