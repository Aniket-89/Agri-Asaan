import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { OrganizationRole } from "@/modules/organizations";
import type { Database } from "@/types/database.types";
import { canWorkWithFarmers } from "./farmer.permissions";
import * as repository from "./farmer.repository";
import type { FarmerInput } from "./farmer.schema";

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
  villageName: string;
  isActive: boolean;
};

export type FarmerDetail = FarmerListItem & { villageId: string; createdAt: string };

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
  query?: string
): Promise<FarmerListItem[] | null> {
  if (!canWorkWithFarmers(context.role)) {
    return null;
  }
  const rows = unwrap(
    await repository.listFarmers(context.supabase, context.organizationId, query),
    "farmers"
  );
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    villageName: row.village?.name ?? "",
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
  if (!row || !row.village) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    villageId: row.village.id,
    villageName: row.village.name,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
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
