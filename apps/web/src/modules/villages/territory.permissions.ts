import type { OrganizationRole } from "@/modules/organizations";

// Server-side pre-checks for a clear UI. RLS is the enforcement layer: a
// regional admin's write is still limited to the regions assigned to them.

export function canViewTerritoryAdmin(role: OrganizationRole): boolean {
  return role === "organization_admin" || role === "regional_admin";
}

export function canManageRegions(role: OrganizationRole): boolean {
  return role === "organization_admin";
}

export function canManageRegion(
  role: OrganizationRole,
  regionId: string,
  assignedRegionIds: ReadonlySet<string>
): boolean {
  return (
    role === "organization_admin" || (role === "regional_admin" && assignedRegionIds.has(regionId))
  );
}
