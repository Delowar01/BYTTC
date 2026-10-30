import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.SEED_TEST_PASSWORD ?? process.env.SEED_SUPER_ADMIN_PASSWORD ?? "";

/** DB tests only run against a LOCAL Supabase stack with seed data + test users. */
export const dbAvailable = /^http:\/\/(127\.0\.0\.1|localhost)/.test(url) && !!serviceKey && !!password;

export type Client = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const anon = (): Client => createClient<Database>(url, anonKey, opts);
export const service = (): Client => createClient<Database>(url, serviceKey, opts);

export async function as(email: string): Promise<Client> {
  const c = createClient<Database>(url, anonKey, opts);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

export const SUPER = "superadmin@example.org";
export const CENTRAL_ADMIN = "central.admin@example.org";
export const CENTRAL_STAFF = "central.staff@example.org";
export const DHK_ADMIN = "dhk.admin@example.org";
export const DHK_STAFF = "dhk.staff@example.org";
export const KHL_ADMIN = "khl.admin@example.org";

export const IDS = {
  dhk: "11111111-0000-4000-8000-000000000001",
  ctg: "11111111-0000-4000-8000-000000000002",
  khl: "11111111-0000-4000-8000-000000000005",
  coa: "22222222-0000-4000-8000-000000000001",
  sessionJul: "33333333-0000-4000-8000-000000000002",
};
