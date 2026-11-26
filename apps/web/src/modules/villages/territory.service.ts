import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { OrganizationRole } from "@/modules/organizations";
import type { Database } from "@/types/database.types";
import { canManageRegion, canManageRegions, canViewTerritoryAdmin } from "./territory.permissions";
import * as repository from "./territory.repository";
import type {
  RegionAssignment,
  RegionInput,
  RegionPincode,
  VillageAssignment,
  VillageInput,
} from "./territory.schema";

// Authenticated, membership-verified context passed in from the app boundary.
export type TerritoryContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
};

export type TerritoryErrorCode = "forbidden" | "duplicate" | "invalid" | "not_found";

export type TerritoryResult = { ok: true } | { ok: false; error: TerritoryErrorCode };

export type TerritoryPerson = { id: string; name: string };

export type TerritoryVillage = {
  id: string;
  name: string;
  lgdCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  mitras: TerritoryPerson[];
};

export type TerritoryRegion = {
  id: string;
  name: string;
  isActive: boolean;
  canManage: boolean;
  regionalAdmins: TerritoryPerson[];
  // Pincodes this region serves; a farmer registering with one joins it.
  pincodes: string[];
  villages: TerritoryVillage[];
};

export type TerritoryOverview = {
  canManageRegions: boolean;
  regions: TerritoryRegion[];
  regionalAdminCandidates: TerritoryPerson[];
  mitraCandidates: TerritoryPerson[];
  // Active villages a regional admin may invite a new mitra into (ADR 0019).
  mitraInviteVillages: { id: string; name: string; regionName: string }[];
  // Active regions an organization admin may invite a regional admin into (ADR 0020).
  regionalAdminInviteRegions: { id: string; name: string }[];
};

// Maps expected database rejections to user-facing outcomes. Anything else is
// unexpected and is thrown, never swallowed.
export function toTerritoryError(error: PostgrestError): TerritoryErrorCode {
  switch (error.code) {
    case "23505":
      return "duplicate";
    case "23514":
    case "23503":
    case "22P02":
      return "invalid";
    case "42501":
      return "forbidden";
    default:
      throw new Error(`Unexpected territory database error (${error.code}).`);
  }
}

function settle(error: PostgrestError | null): TerritoryResult {
  return error ? { ok: false, error: toTerritoryError(error) } : { ok: true };
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`Unable to load ${what}.`);
  }
  return result.data;
}

export async function getTerritoryOverview(
  context: TerritoryContext
): Promise<TerritoryOverview | null> {
  if (!canViewTerritoryAdmin(context.role)) {
    return null;
  }

  const { supabase, organizationId } = context;
  const [regions, villages, adminAssignments, mitraAssignments, members, pincodes] =
    await Promise.all([
      repository.listRegions(supabase, organizationId).then((r) => unwrap(r, "regions")),
      repository.listVillages(supabase, organizationId).then((r) => unwrap(r, "villages")),
      repository
        .listRegionalAdminAssignments(supabase, organizationId)
        .then((r) => unwrap(r, "regional admin assignments")),
      repository
        .listMitraAssignments(supabase, organizationId)
        .then((r) => unwrap(r, "mitra assignments")),
      repository
        .listMembersWithRoles(supabase, organizationId, ["regional_admin", "mitra"])
        .then((r) => unwrap(r, "members")),
      repository.listRegionPincodes(supabase, organizationId).then((r) => unwrap(r, "pincodes")),
    ]);

  const profileIds = [...new Set(members.map((member) => member.user_id))];
  const profiles = profileIds.length
    ? unwrap(await repository.listProfileNames(supabase, profileIds), "member names")
    : [];
  const nameOf = new Map(profiles.map((profile) => [profile.id, profile.full_name ?? ""]));
  const person = (id: string): TerritoryPerson => ({ id, name: nameOf.get(id) || id.slice(0, 8) });

  const assignedRegionIds = new Set(
    adminAssignments.filter((a) => a.user_id === context.userId).map((a) => a.region_id)
  );
  const byName = (a: TerritoryPerson, b: TerritoryPerson) => a.name.localeCompare(b.name);
  const regionNameOf = new Map(regions.map((region) => [region.id, region.name]));

  return {
    regionalAdminInviteRegions: canManageRegions(context.role)
      ? regions
          .filter((region) => region.is_active)
          .map((region) => ({ id: region.id, name: region.name }))
      : [],
    mitraInviteVillages:
      context.role === "regional_admin"
        ? villages
            .filter((village) => village.is_active && assignedRegionIds.has(village.region_id))
            .map((village) => ({
              id: village.id,
              name: village.name,
              regionName: regionNameOf.get(village.region_id) ?? "",
            }))
        : [],
    canManageRegions: canManageRegions(context.role),
    regionalAdminCandidates: members
      .filter((m) => m.role === "regional_admin")
      .map((m) => person(m.user_id))
      .sort(byName),
    mitraCandidates: members
      .filter((m) => m.role === "mitra")
      .map((m) => person(m.user_id))
      .sort(byName),
    regions: regions.map((region) => ({
      id: region.id,
      name: region.name,
      isActive: region.is_active,
      canManage: canManageRegion(context.role, region.id, assignedRegionIds),
      regionalAdmins: adminAssignments
        .filter((a) => a.region_id === region.id)
        .map((a) => person(a.user_id))
        .sort(byName),
      pincodes: pincodes.filter((pin) => pin.region_id === region.id).map((pin) => pin.pincode),
      villages: villages
        .filter((village) => village.region_id === region.id)
        .map((village) => ({
          id: village.id,
          name: village.name,
          lgdCode: village.lgd_code,
          latitude: village.latitude,
          longitude: village.longitude,
          isActive: village.is_active,
          mitras: mitraAssignments
            .filter((a) => a.village_id === village.id)
            .map((a) => person(a.user_id))
            .sort(byName),
        })),
    })),
  };
}

export async function createRegion(
  context: TerritoryContext,
  input: RegionInput
): Promise<TerritoryResult> {
  if (!canManageRegions(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertRegion(context.supabase, context.organizationId, input);
  return settle(error);
}

export async function createVillage(
  context: TerritoryContext,
  input: VillageInput
): Promise<TerritoryResult> {
  if (!canViewTerritoryAdmin(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertVillage(context.supabase, context.organizationId, input);
  return settle(error);
}

export async function assignRegionalAdmin(
  context: TerritoryContext,
  input: RegionAssignment
): Promise<TerritoryResult> {
  if (!canManageRegions(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertRegionalAdminAssignment(
    context.supabase,
    context.organizationId,
    input
  );
  return settle(error);
}

export async function removeRegionalAdmin(
  context: TerritoryContext,
  input: RegionAssignment
): Promise<TerritoryResult> {
  if (!canManageRegions(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await repository.deleteRegionalAdminAssignment(
    context.supabase,
    context.organizationId,
    input
  );
  if (error) {
    return settle(error);
  }
  return count ? { ok: true } : { ok: false, error: "not_found" };
}

export async function assignMitra(
  context: TerritoryContext,
  input: VillageAssignment
): Promise<TerritoryResult> {
  if (!canViewTerritoryAdmin(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertMitraAssignment(
    context.supabase,
    context.organizationId,
    input
  );
  return settle(error);
}

export async function removeMitra(
  context: TerritoryContext,
  input: VillageAssignment
): Promise<TerritoryResult> {
  if (!canViewTerritoryAdmin(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await repository.deleteMitraAssignment(
    context.supabase,
    context.organizationId,
    input
  );
  if (error) {
    return settle(error);
  }
  return count ? { ok: true } : { ok: false, error: "not_found" };
}

// Only organization admins change which pincodes a region serves; adding one
// also brings waiting farmers with that pincode into the region (database
// trigger).
export async function addRegionPincode(
  context: TerritoryContext,
  input: RegionPincode
): Promise<TerritoryResult> {
  if (!canManageRegions(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertRegionPincode(
    context.supabase,
    context.organizationId,
    input
  );
  return settle(error);
}

export async function removeRegionPincode(
  context: TerritoryContext,
  input: RegionPincode
): Promise<TerritoryResult> {
  if (!canManageRegions(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await repository.deleteRegionPincode(
    context.supabase,
    context.organizationId,
    input
  );
  if (error) {
    return settle(error);
  }
  return count ? { ok: true } : { ok: false, error: "not_found" };
}
