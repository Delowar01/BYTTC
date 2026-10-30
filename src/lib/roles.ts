import type { Database } from "@/lib/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  central_admin: "Central Admin",
  central_staff: "Central Staff",
  institute_admin: "Institute Admin",
  institute_staff: "Institute Staff",
};

export const CENTRAL: AppRole[] = ["super_admin", "central_admin", "central_staff"];
export const PUBLISHERS: AppRole[] = ["super_admin", "central_admin"];
export const CMS_EDITORS: AppRole[] = ["super_admin", "central_admin"];
export const SUPER: AppRole[] = ["super_admin"];
export const ALL_STAFF: AppRole[] = [...CENTRAL, "institute_admin", "institute_staff"];

export function isCentral(role: AppRole) {
  return CENTRAL.includes(role);
}
