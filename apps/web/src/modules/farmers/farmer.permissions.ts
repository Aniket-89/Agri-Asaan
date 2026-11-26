import type { OrganizationRole } from "@/modules/organizations";

// UI pre-check only. RLS decides which villages each role can actually use.
export function canWorkWithFarmers(role: OrganizationRole): boolean {
  return role === "organization_admin" || role === "regional_admin" || role === "mitra";
}

// Placing a farmer who registered by address into a village (ADR 0021).
// Mitras never see farmers before they are placed.
export function canPlaceFarmers(role: OrganizationRole): boolean {
  return role === "organization_admin" || role === "regional_admin";
}
