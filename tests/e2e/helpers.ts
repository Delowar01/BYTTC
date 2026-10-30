import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "LocalDev#2026";
export const SUPER = "superadmin@example.org";

export async function login(page: Page, email = SUPER, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Accept confirm() dialogs and answer prompt() dialogs with `reason`. */
export function autoAcceptDialogs(page: Page, reason = "E2E test reason") {
  page.on("dialog", (d) => (d.type() === "prompt" ? d.accept(reason) : d.accept()));
}

export const uid = () => Date.now().toString(36).toUpperCase().slice(-6);

/** Local test DB only: clear the per-client rate limiter so each test starts fresh. */
export async function resetRateLimit(kind: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("E2E tests must run against a local Supabase");
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error } = await db.from("lookup_attempts").delete().eq("kind", kind);
  if (error) throw error;
}
