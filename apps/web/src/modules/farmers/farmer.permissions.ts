import type { OrganizationRole } from "@/modules/organizations";

// UI pre-check only. RLS decides which villages each role can actually use.
export function canWorkWithFarmers(role: OrganizationRole): boolean {
  return role === "organization_admin" || role === "regional_admin" || role === "mitra";
}
