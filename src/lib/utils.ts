import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined, locale: "en" | "bn" = "en") {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function localizeDigits(value: string | number, locale: "en" | "bn") {
  const s = String(value);
  return locale === "bn" ? s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : s;
}

/** Escape a user-supplied term for PostgREST `ilike` filters inside `or()`. */
export function escapeLike(term: string) {
  return term.replace(/[%_\\,()."']/g, " ").trim();
}

export const PAGE_SIZE = 25;

export function pageRange(page: number, size = PAGE_SIZE) {
  const p = Math.max(1, page || 1);
  return { from: (p - 1) * size, to: p * size - 1, page: p };
}
