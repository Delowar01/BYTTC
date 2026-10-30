import { z } from "zod";

/** Form helpers: empty strings become null; checkboxes arrive as "on". */
export const optText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));
export const reqText = (label: string, max = 500) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long`);
export const optInt = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Enter a whole number between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });
export const optNumber = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Enter a number between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });
export const reqNumber = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .min(1, `${label} is required`)
    .transform((v, ctx) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });
export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");
export const code = (label: string, max = 20) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(new RegExp(`^[A-Z0-9-]{2,${max}}$`), `${label}: 2–${max} letters, digits or dashes`));
export const optEmail = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim().toLowerCase() : null))
  .pipe(z.email("Enter a valid email").nullable());
export const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.iso.date("Enter a valid date").nullable());
export const optUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
  .pipe(
    z
      .string()
      .regex(/^(\/|https?:\/\/)/, "Enter a full URL (https://…) or a site path (/…)")
      .nullable(),
  );
export const uuid = (label: string) => z.uuid(`${label} is required`);
