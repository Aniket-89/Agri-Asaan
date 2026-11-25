import type { NavIcon } from "./nav-link";
import { canUseBookingInbox } from "@/modules/bookings";
import { canViewFleet } from "@/modules/drones";
import { canWorkWithFarmers } from "@/modules/farmers";
import { canViewFieldMap } from "@/modules/fields";
import type { OrganizationRole } from "@/modules/organizations";
import { canManageSlots } from "@/modules/slots";
import { canViewTerritoryAdmin } from "@/modules/villages";

export type NavLabel =
  "home" | "bookings" | "myFarm" | "myJobs" | "farmers" | "map" | "fleet" | "slots" | "territory";

export type NavItem = { label: NavLabel; path: string; icon: NavIcon; exact?: boolean };

// The sections a role can open, most-used first. The bottom bar on phones
// shows the first few; the rest stay on Home and in the sidebar.
export function navItemsForRole(role: OrganizationRole): NavItem[] {
  const items: NavItem[] = [{ label: "home", path: "/dashboard", icon: "home", exact: true }];
  if (role === "pilot") {
    items.push({ label: "myJobs", path: "/dashboard/my-jobs", icon: "myJobs" });
  }
  if (role === "farmer") {
    items.push({ label: "myFarm", path: "/dashboard/my-farm", icon: "myFarm" });
  }
  if (canUseBookingInbox(role)) {
    items.push({ label: "bookings", path: "/dashboard/bookings", icon: "bookings" });
  }
  if (canWorkWithFarmers(role)) {
    items.push({ label: "farmers", path: "/dashboard/farmers", icon: "farmers" });
  }
  if (canViewFieldMap(role)) {
    items.push({ label: "map", path: "/dashboard/map", icon: "map" });
  }
  if (canViewFleet(role)) {
    items.push({ label: "fleet", path: "/dashboard/fleet", icon: "fleet" });
  }
  if (canManageSlots(role)) {
    items.push({ label: "slots", path: "/dashboard/slots", icon: "slots" });
  }
  if (canViewTerritoryAdmin(role)) {
    items.push({ label: "territory", path: "/dashboard/territory", icon: "territory" });
  }
  return items;
}

export const BOTTOM_NAV_LIMIT = 5;

// Phones get at most five slots: all items when they fit, otherwise the first
// four plus "More" (Home lists every section).
export function bottomNavItems(items: NavItem[]): { items: NavItem[]; more: boolean } {
  if (items.length <= BOTTOM_NAV_LIMIT) {
    return { items, more: false };
  }
  return { items: items.slice(0, BOTTOM_NAV_LIMIT - 1), more: true };
}
