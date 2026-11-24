import type { PostgrestError } from "@supabase/supabase-js";

import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { DroneInput, DroneStatus, DroneStatusInput } from "./drone.schema";
import { canManageFleetItem, canViewFleet } from "./fleet.permissions";
import * as repository from "./fleet.repository";

export type FleetRegion = { id: string; name: string };

export type DroneItem = {
  id: string;
  uid: string;
  model: string;
  status: DroneStatus;
  homeRegionName: string | null;
  canManage: boolean;
};

export type FleetScope = {
  regions: FleetRegion[];
  // Regions the caller may home new drones/pilots in.
  manageableRegions: FleetRegion[];
  canAddWithoutRegion: boolean;
  assignedRegionIds: ReadonlySet<string>;
};

export type FleetResult = { ok: true } | { ok: false; error: DomainErrorCode };

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`Unable to load ${what}.`);
  }
  return result.data;
}

export async function getFleetScope(context: ActiveMembershipContext): Promise<FleetScope | null> {
  if (!canViewFleet(context.role)) {
    return null;
  }
  const { supabase, organizationId, userId, role } = context;
  const [regions, own] = await Promise.all([
    repository.listRegions(supabase, organizationId).then((r) => unwrap(r, "regions")),
    role === "regional_admin"
      ? repository
          .listOwnRegionIds(supabase, organizationId, userId)
          .then((r) => unwrap(r, "regions"))
      : Promise.resolve([]),
  ]);
  const assignedRegionIds = new Set(own.map((row) => row.region_id));
  return {
    regions,
    manageableRegions: regions.filter((region) =>
      canManageFleetItem(role, region.id, assignedRegionIds)
    ),
    canAddWithoutRegion: canManageFleetItem(role, null, assignedRegionIds),
    assignedRegionIds,
  };
}

export async function listDrones(
  context: ActiveMembershipContext,
  scope: FleetScope
): Promise<DroneItem[]> {
  const rows = unwrap(
    await repository.listDrones(context.supabase, context.organizationId),
    "drones"
  );
  const regionName = new Map(scope.regions.map((region) => [region.id, region.name]));
  return rows.map((row) => ({
    id: row.id,
    uid: row.uid,
    model: row.model,
    status: row.status,
    homeRegionName: row.home_region_id ? (regionName.get(row.home_region_id) ?? null) : null,
    canManage: canManageFleetItem(context.role, row.home_region_id, scope.assignedRegionIds),
  }));
}

export async function addDrone(
  context: ActiveMembershipContext,
  input: DroneInput
): Promise<FleetResult> {
  if (!canViewFleet(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertDrone(context.supabase, context.organizationId, input);
  return error ? { ok: false, error: toDomainError(error) } : { ok: true };
}

export async function setDroneStatus(
  context: ActiveMembershipContext,
  input: DroneStatusInput
): Promise<FleetResult> {
  if (!canViewFleet(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await repository.updateDroneStatus(
    context.supabase,
    context.organizationId,
    input
  );
  if (error) {
    return { ok: false, error: toDomainError(error) };
  }
  // RLS hides drones the caller may not change, so zero rows means "not yours".
  return count ? { ok: true } : { ok: false, error: "forbidden" };
}
