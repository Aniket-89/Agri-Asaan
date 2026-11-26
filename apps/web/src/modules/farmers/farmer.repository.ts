import type { SupabaseClient } from "@supabase/supabase-js";

import { escapeLikePattern } from "@/lib/utils/db-errors";
import type { Database } from "@/types/database.types";
import type { FarmerInput } from "./farmer.schema";

type Client = SupabaseClient<Database>;

const FARMER_LIST_LIMIT = 50;

// All queries run with the caller's session; RLS limits results to the
// farmers the caller may see.

export async function listFarmers(
  supabase: Client,
  tenantId: string,
  query?: string,
  unplacedOnly = false
) {
  let request = supabase
    .from("farmers")
    .select(
      "id, full_name, phone, is_active, region_id, locality, pincode, village:villages!farmers_village_same_tenant(name), tehsil:geo_subdistricts!farmers_subdistrict_code_fkey(name, district:geo_districts!geo_subdistricts_district_code_fkey(name))"
    )
    .eq("tenant_id", tenantId)
    .order("full_name")
    .limit(FARMER_LIST_LIMIT);

  if (unplacedOnly) {
    request = request.is("village_id", null);
  }

  if (query) {
    // Three or more digits (spaces, "+" and "-" ignored) search the phone
    // number; anything else searches the name.
    const compact = query.replace(/[\s+-]/g, "");
    request = /^\d{3,}$/.test(compact)
      ? request.like("phone", `%${compact}%`)
      : request.ilike("full_name", `%${escapeLikePattern(query)}%`);
  }

  return request;
}

export async function getFarmer(supabase: Client, tenantId: string, farmerId: string) {
  return supabase
    .from("farmers")
    .select(
      "id, full_name, phone, is_active, created_at, region_id, pincode, locality, address_line, region:regions!farmers_region_same_tenant(name), village:villages!farmers_village_same_tenant(id, name, latitude, longitude), tehsil:geo_subdistricts!farmers_subdistrict_code_fkey(name, district:geo_districts!geo_subdistricts_district_code_fkey(name))"
    )
    .eq("tenant_id", tenantId)
    .eq("id", farmerId)
    .maybeSingle();
}

export async function insertFarmer(supabase: Client, tenantId: string, input: FarmerInput) {
  return supabase.from("farmers").insert({
    id: input.id,
    tenant_id: tenantId,
    village_id: input.villageId,
    full_name: input.fullName,
    phone: input.phone,
    // Overwritten with the server clock by a database trigger.
    consent_recorded_at: new Date().toISOString(),
  });
}

export async function listVillagesForTenant(supabase: Client, tenantId: string) {
  return supabase
    .from("villages")
    .select("id, name, region_id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
}

export async function listOwnRegionIds(supabase: Client, tenantId: string, userId: string) {
  return supabase
    .from("regional_admin_regions")
    .select("region_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
}

export async function listOwnVillageIds(supabase: Client, tenantId: string, userId: string) {
  return supabase
    .from("mitra_villages")
    .select("village_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
}

// Places a farmer who has no village yet. RLS checks the caller may manage
// the farmer now and in the chosen village.
export async function setFarmerVillage(
  supabase: Client,
  tenantId: string,
  farmerId: string,
  villageId: string
) {
  return supabase
    .from("farmers")
    .update({ village_id: villageId }, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("id", farmerId)
    .is("village_id", null);
}
