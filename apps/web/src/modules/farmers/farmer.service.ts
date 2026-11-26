import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { OrganizationRole } from "@/modules/organizations";
import type { Database } from "@/types/database.types";
import { canPlaceFarmers, canWorkWithFarmers } from "./farmer.permissions";
import * as repository from "./farmer.repository";
import type { FarmerInput, FarmerPlacementInput } from "./farmer.schema";

// Authenticated, membership-verified context passed in from the app boundary.
export type FarmerContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
};

export type FarmerListItem = {
  id: string;
  fullName: string;
  phone: string;
  // Null until the farmer is placed in a village (ADR 0021).
  villageName: string | null;
  // Where the farmer said they live: shown while they have no village.
  locality: string | null;
  pincode: string | null;
  // The farmer's tehsil and district (LGD names), when they gave them.
  tehsilName: string | null;
  districtName: string | null;
  // False when no region covers the farmer's place yet (outside the service area).
  hasRegion: boolean;
  isActive: boolean;
};

export type FarmerDetail = FarmerListItem & {
  villageId: string | null;
  regionId: string | null;
  regionName: string | null;
  addressLine: string | null;
  // The village pin, when recorded; maps start there before a field is set.
  villageLocation: { latitude: number; longitude: number } | null;
  createdAt: string;
};

export type PlaceFarmerResult = { ok: true } | { ok: false; error: DomainErrorCode };

export type VillageOption = { id: string; name: string };

export type RegisterFarmerResult =
  { ok: true; farmerId: string } | { ok: false; error: DomainErrorCode };

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`Unable to load ${what}.`);
  }
  return result.data;
}

export async function listFarmers(
  context: FarmerContext,
  query?: string,
  unplacedOnly = false
): Promise<FarmerListItem[] | null> {
  if (!canWorkWithFarmers(context.role)) {
    return null;
  }
  const rows = unwrap(
    await repository.listFarmers(context.supabase, context.organizationId, query, unplacedOnly),
    "farmers"
  );
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    villageName: row.village?.name ?? null,
    locality: row.locality,
    pincode: row.pincode,
    tehsilName: row.tehsil?.name ?? null,
    districtName: row.tehsil?.district?.name ?? null,
    hasRegion: row.region_id !== null,
    isActive: row.is_active,
  }));
}

export async function getFarmer(
  context: FarmerContext,
  farmerId: string
): Promise<FarmerDetail | null> {
  if (!canWorkWithFarmers(context.role)) {
    return null;
  }
  const result = await repository.getFarmer(context.supabase, context.organizationId, farmerId);
  if (result.error) {
    throw new Error("Unable to load farmer.");
  }
  const row = result.data;
  if (!row) {
    return null;
  }
  const village = row.village;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    villageId: village?.id ?? null,
    villageName: village?.name ?? null,
    regionId: row.region_id,
    regionName: row.region?.name ?? null,
    hasRegion: row.region_id !== null,
    locality: row.locality,
    pincode: row.pincode,
    tehsilName: row.tehsil?.name ?? null,
    districtName: row.tehsil?.district?.name ?? null,
    addressLine: row.address_line,
    villageLocation:
      village && village.latitude !== null && village.longitude !== null
        ? { latitude: village.latitude, longitude: village.longitude }
        : null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Villages a farmer without one can be placed in: their region's villages,
// or any village for an organization admin when the farmer has no region.
// RLS re-checks the caller manages both the farmer and the village.
export async function listPlacementVillages(
  context: FarmerContext,
  farmer: FarmerDetail
): Promise<VillageOption[]> {
  if (!canPlaceFarmers(context.role) || farmer.villageId) {
    return [];
  }
  const villages = unwrap(
    await repository.listVillagesForTenant(context.supabase, context.organizationId),
    "villages"
  );
  return villages
    .filter((village) =>
      farmer.regionId
        ? village.region_id === farmer.regionId
        : context.role === "organization_admin"
    )
    .map(({ id, name }) => ({ id, name }));
}

export async function placeFarmer(
  context: FarmerContext,
  input: FarmerPlacementInput
): Promise<PlaceFarmerResult> {
  if (!canPlaceFarmers(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await repository.setFarmerVillage(
    context.supabase,
    context.organizationId,
    input.farmerId,
    input.villageId
  );
  if (error) {
    return { ok: false, error: toDomainError(error) };
  }
  return count === 0 ? { ok: false, error: "not_found" } : { ok: true };
}

// Villages the caller can register farmers in. Mirrors the database rule
// (can_manage_farmers_in_village) so the form only offers usable choices;
// RLS still enforces it on insert.
export async function listRegistrationVillages(context: FarmerContext): Promise<VillageOption[]> {
  const { supabase, organizationId, userId, role } = context;
  if (!canWorkWithFarmers(role)) {
    return [];
  }

  const villages = unwrap(
    await repository.listVillagesForTenant(supabase, organizationId),
    "villages"
  );

  if (role === "organization_admin") {
    return villages.map(({ id, name }) => ({ id, name }));
  }
  if (role === "regional_admin") {
    const regionIds = new Set(
      unwrap(await repository.listOwnRegionIds(supabase, organizationId, userId), "regions").map(
        (row) => row.region_id
      )
    );
    return villages.filter((v) => regionIds.has(v.region_id)).map(({ id, name }) => ({ id, name }));
  }
  const villageIds = new Set(
    unwrap(await repository.listOwnVillageIds(supabase, organizationId, userId), "villages").map(
      (row) => row.village_id
    )
  );
  return villages.filter((v) => villageIds.has(v.id)).map(({ id, name }) => ({ id, name }));
}

export async function registerFarmer(
  context: FarmerContext,
  input: FarmerInput
): Promise<RegisterFarmerResult> {
  if (!canWorkWithFarmers(context.role)) {
    return { ok: false, error: "forbidden" };
  }

  const { error } = await repository.insertFarmer(context.supabase, context.organizationId, input);
  if (!error) {
    return { ok: true, farmerId: input.id };
  }

  const code = toDomainError(error);
  // A retried submission reuses the form's id: if that farmer already exists
  // and is visible to the caller, the earlier attempt succeeded.
  if (code === "duplicate" && (await getFarmer(context, input.id))) {
    return { ok: true, farmerId: input.id };
  }
  return { ok: false, error: code };
}
