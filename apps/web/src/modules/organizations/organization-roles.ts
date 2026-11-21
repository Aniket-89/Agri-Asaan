import type { Database } from "@/types/database.types";

type DatabaseOrganizationRole = Database["public"]["Enums"]["organization_role"];

// super_admin and admin still exist in the Postgres enum but are blocked by a
// constraint (ADR 0002). Application code only knows the current roles.
export const ORGANIZATION_ROLES = [
  "organization_admin",
  "regional_admin",
  "mitra",
  "farmer",
  "pilot",
] as const satisfies readonly DatabaseOrganizationRole[];

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export function isOrganizationRole(role: DatabaseOrganizationRole): role is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(role);
}
