import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Current user + active profile, or null. Deduplicated per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, institute_id, is_active, institutes(name_en, code, status)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { supabase, user, profile };
});

/** Use in pages/layouts: redirects when not signed in or not permitted. */
export async function requireRole(roles: AppRole[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.profile.role)) redirect("/admin?denied=1");
  return session;
}

export class AuthError extends Error {}

/** Use in server actions / route handlers: throws instead of redirecting. */
export async function assertRole(roles: AppRole[]) {
  const session = await getSession();
  if (!session) throw new AuthError("You are not signed in.");
  if (!roles.includes(session.profile.role)) throw new AuthError("You do not have permission for this action.");
  return session;
}
