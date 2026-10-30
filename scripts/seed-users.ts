/**
 * Bootstrap accounts.
 *
 *   npm run seed:users                 # create/update the Super Admin from env
 *   npm run seed:users -- --test-users # also create role test accounts (LOCAL ONLY)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

type Role = Database["public"]["Enums"]["app_role"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_SUPER_ADMIN_EMAIL;
const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
if (!url || !key || !email || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_SUPER_ADMIN_EMAIL or SEED_SUPER_ADMIN_PASSWORD");
  process.exit(1);
}
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error("SEED_SUPER_ADMIN_PASSWORD must be at least 10 characters with upper, lower case letters and digits (quote it if it contains #).");
  process.exit(1);
}
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
const withTestUsers = process.argv.includes("--test-users");
if (withTestUsers && !isLocal) {
  console.error("Refusing to create test users on a non-local Supabase project.");
  process.exit(1);
}

const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function upsertUser(userEmail: string, userPassword: string, fullName: string, role: Role, instituteCode?: string) {
  let instituteId: string | null = null;
  if (instituteCode) {
    const { data, error } = await admin.from("institutes").select("id").eq("code", instituteCode).single();
    if (error) throw new Error(`Institute ${instituteCode} not found`);
    instituteId = data.id;
  }
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = list.users.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase());
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email: userEmail, password: userPassword, email_confirm: true });
    if (error) throw error;
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: userPassword });
    if (error) throw error;
  }
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    email: userEmail,
    full_name: fullName,
    role,
    institute_id: instituteId,
    is_active: true,
  });
  if (error) throw error;
  console.log(`✔ ${role.padEnd(16)} ${userEmail}`);
}

async function main() {
  await upsertUser(email!, password!, "Super Admin", "super_admin");
  if (withTestUsers) {
    const pw = process.env.SEED_TEST_PASSWORD ?? password!;
    await upsertUser("central.admin@example.org", pw, "Central Admin (test)", "central_admin");
    await upsertUser("central.staff@example.org", pw, "Central Staff (test)", "central_staff");
    await upsertUser("dhk.admin@example.org", pw, "Dhaka Institute Admin (test)", "institute_admin", "DHK-001");
    await upsertUser("dhk.staff@example.org", pw, "Dhaka Institute Staff (test)", "institute_staff", "DHK-001");
    await upsertUser("ctg.admin@example.org", pw, "Chattogram Institute Admin (test)", "institute_admin", "CTG-001");
    await upsertUser("khl.admin@example.org", pw, "Khulna (suspended) Admin (test)", "institute_admin", "KHL-001");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
