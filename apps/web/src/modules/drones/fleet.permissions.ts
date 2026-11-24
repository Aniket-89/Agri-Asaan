import type { OrganizationRole } from "@/modules/organizations";

// UI pre-checks mirroring can_view_fleet / can_manage_fleet_item. RLS is the
// enforcement layer.

export function canViewFleet(role: OrganizationRole): boolean {
  return role === "organization_admin" || role === "regional_admin";
}

export function canManageFleetItem(
  role: OrganizationRole,
  homeRegionId: string | null,
  assignedRegionIds: ReadonlySet<string>
): boolean {
  if (role === "organization_admin") {
    return true;
  }
  return role === "regional_admin" && homeRegionId !== null && assignedRegionIds.has(homeRegionId);
}
