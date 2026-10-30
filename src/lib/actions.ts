import "server-only";
import { unstable_rethrow } from "next/navigation";
import { assertRole, AuthError, type Session } from "@/lib/auth";
import { fail, type FormState } from "@/lib/forms";
import type { AppRole } from "@/lib/roles";

/**
 * Server-action guard: verifies the caller's role on the server before running
 * `fn`. Database RLS enforces the same rules independently.
 */
export async function withRole(roles: AppRole[], fn: (session: Session) => Promise<FormState>): Promise<FormState> {
  try {
    const session = await assertRole(roles);
    return await fn(session);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthError) return fail(e.message);
    console.error(e);
    return fail(e instanceof Error ? e.message : "Unexpected error");
  }
}
