import type { PostgrestError } from "@supabase/supabase-js";

import { toDomainError } from "@/lib/utils/db-errors";
import {
  canManageFleetItem,
  canViewFleet,
  type FleetResult,
  type FleetScope,
} from "@/modules/drones";
import type { ActiveMembershipContext } from "@/modules/organizations";
import * as repository from "./pilot.repository";
import type { PilotAvailabilityInput, PilotProfileInput } from "./pilot.schema";

export type PilotItem = {
  userId: string;
  name: string;
  profile: {
    homeRegionName: string | null;
    licenseNumber: string | null;
    isActive: boolean;
    canManage: boolean;
  } | null;
};

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`Unable to load ${what}.`);
  }
  return result.data;
}

// Every pilot member of the tenant, with their profile when one exists.
export async function listPilots(
  context: ActiveMembershipContext,
  scope: FleetScope
): Promise<PilotItem[]> {
  const { supabase, organizationId, role } = context;
  const [members, profiles] = await Promise.all([
    repository.listPilotMembers(supabase, organizationId).then((r) => unwrap(r, "pilots")),
    repository.listPilotProfiles(supabase, organizationId).then((r) => unwrap(r, "pilot profiles")),
  ]);

  const ids = members.map((member) => member.user_id);
  const names = ids.length
    ? unwrap(await repository.listProfileNames(supabase, ids), "pilot names")
    : [];
  const nameOf = new Map(names.map((row) => [row.id, row.full_name ?? ""]));
  const profileOf = new Map(profiles.map((row) => [row.user_id, row]));
  const regionName = new Map(scope.regions.map((region) => [region.id, region.name]));

  return ids
    .map((userId) => {
      const profile = profileOf.get(userId);
      return {
        userId,
        name: nameOf.get(userId) || userId.slice(0, 8),
        profile: profile
          ? {
              homeRegionName: profile.home_region_id
                ? (regionName.get(profile.home_region_id) ?? null)
                : null,
              licenseNumber: profile.license_number,
              isActive: profile.is_active,
              canManage: canManageFleetItem(role, profile.home_region_id, scope.assignedRegionIds),
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPilotProfile(
  context: ActiveMembershipContext,
  input: PilotProfileInput
): Promise<FleetResult> {
  if (!canViewFleet(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertPilotProfile(
    context.supabase,
    context.organizationId,
    input
  );
  return error ? { ok: false, error: toDomainError(error) } : { ok: true };
}

export async function setPilotAvailability(
  context: ActiveMembershipContext,
  input: PilotAvailabilityInput
): Promise<FleetResult> {
  if (!canViewFleet(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await repository.updatePilotAvailability(
    context.supabase,
    context.organizationId,
    input
  );
  if (error) {
    return { ok: false, error: toDomainError(error) };
  }
  return count ? { ok: true } : { ok: false, error: "forbidden" };
}
