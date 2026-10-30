import type { ZodError } from "zod";

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Changes on every response so the form re-mounts with returned values. */
  stamp?: number;
};

export const initialFormState: FormState = { ok: false };

/** Plain object of string values (files excluded), trimmed. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value.trim();
  }
  return out;
}

export function fail(message: string, values?: Record<string, string>, errors?: Record<string, string>): FormState {
  return { ok: false, message, values, errors, stamp: Date.now() };
}

export function success(message: string): FormState {
  return { ok: true, message, stamp: Date.now() };
}

export function zodFail(error: ZodError, values: Record<string, string>): FormState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    errors[key] ??= issue.message;
  }
  return fail("Please correct the highlighted fields.", values, errors);
}

/** Map common Postgres errors to friendly messages. */
export function dbMessage(error: { code?: string; message: string; details?: string | null }) {
  if (error.code === "23505") {
    const m = /Key \((.+?)\)=\((.+?)\)/.exec(error.details ?? "");
    return m ? `A record with ${m[1]} "${m[2]}" already exists.` : "A record with the same unique value already exists.";
  }
  if (error.code === "23503") return "This record is referenced by other records and cannot be removed or changed.";
  if (error.code === "42501") return "You do not have permission for this action.";
  if (error.code === "23514") return "A value is outside the allowed range or format.";
  return error.message;
}
