import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type {
  RegionAssignment,
  RegionInput,
  RegionDistrict,
  RegionRate,
  RegionTehsil,
  VillageAssignment,
  VillageInput,
} from "./territory.schema";

type Client = SupabaseClient<Database>;

// All queries run with the caller's session; RLS scopes every result to the
// caller's tenant and role.

export async function listRegions(supabase: Client, tenantId: string) {
  return supabase
    .from("regions")
    .select("id, name, is_active, rate_per_acre")
    .eq("tenant_id", tenantId)
    .order("name");
}

export async function listVillages(supabase: Client, tenantId: string) {
  return supabase
    .from("villages")
    .select("id, region_id, name, lgd_code, latitude, longitude, is_active")
    .eq("tenant_id", tenantId)
    .order("name");
}

export async function listRegionalAdminAssignments(supabase: Client, tenantId: string) {
  return supabase
    .from("regional_admin_regions")
    .select("region_id, user_id")
    .eq("tenant_id", tenantId);
}

export async function listMitraAssignments(supabase: Client, tenantId: string) {
  return supabase.from("mitra_villages").select("village_id, user_id").eq("tenant_id", tenantId);
}

export async function listMembersWithRoles(
  supabase: Client,
  tenantId: string,
  roles: Array<"regional_admin" | "mitra">
) {
  return supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", tenantId)
    .in("role", roles);
}

export async function listProfileNames(supabase: Client, profileIds: string[]) {
  return supabase.from("profiles").select("id, full_name").in("id", profileIds);
}

export async function insertRegion(supabase: Client, tenantId: string, input: RegionInput) {
  return supabase.from("regions").insert({ tenant_id: tenantId, name: input.name });
}

export async function insertVillage(supabase: Client, tenantId: string, input: VillageInput) {
  return supabase.from("villages").insert({
    tenant_id: tenantId,
    region_id: input.regionId,
    name: input.name,
    lgd_code: input.lgdCode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });
}

export async function insertRegionalAdminAssignment(
  supabase: Client,
  tenantId: string,
  input: RegionAssignment
) {
  return supabase
    .from("regional_admin_regions")
    .insert({ tenant_id: tenantId, region_id: input.regionId, user_id: input.userId });
}

export async function deleteRegionalAdminAssignment(
  supabase: Client,
  tenantId: string,
  input: RegionAssignment
) {
  return supabase
    .from("regional_admin_regions")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("region_id", input.regionId)
    .eq("user_id", input.userId);
}

export async function insertMitraAssignment(
  supabase: Client,
  tenantId: string,
  input: VillageAssignment
) {
  return supabase
    .from("mitra_villages")
    .insert({ tenant_id: tenantId, village_id: input.villageId, user_id: input.userId });
}

export async function deleteMitraAssignment(
  supabase: Client,
  tenantId: string,
  input: VillageAssignment
) {
  return supabase
    .from("mitra_villages")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("village_id", input.villageId)
    .eq("user_id", input.userId);
}

export async function listRegionDistricts(supabase: Client, tenantId: string) {
  return supabase
    .from("region_districts")
    .select(
      "region_id, district_code, district:geo_districts!region_districts_district_code_fkey(name, state:geo_states!geo_districts_state_code_fkey(name))"
    )
    .eq("tenant_id", tenantId);
}

export async function listRegionTehsils(supabase: Client, tenantId: string) {
  return supabase
    .from("region_subdistricts")
    .select(
      "region_id, subdistrict_code, tehsil:geo_subdistricts!region_subdistricts_subdistrict_code_fkey(name, district:geo_districts!geo_subdistricts_district_code_fkey(name))"
    )
    .eq("tenant_id", tenantId);
}

export async function insertRegionDistrict(
  supabase: Client,
  tenantId: string,
  input: RegionDistrict
) {
  return supabase
    .from("region_districts")
    .insert({ tenant_id: tenantId, region_id: input.regionId, district_code: input.districtCode });
}

export async function deleteRegionDistrict(
  supabase: Client,
  tenantId: string,
  input: RegionDistrict
) {
  return supabase
    .from("region_districts")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("region_id", input.regionId)
    .eq("district_code", input.districtCode);
}

export async function insertRegionTehsil(supabase: Client, tenantId: string, input: RegionTehsil) {
  return supabase.from("region_subdistricts").insert({
    tenant_id: tenantId,
    region_id: input.regionId,
    subdistrict_code: input.subdistrictCode,
  });
}

export async function deleteRegionTehsil(supabase: Client, tenantId: string, input: RegionTehsil) {
  return supabase
    .from("region_subdistricts")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("region_id", input.regionId)
    .eq("subdistrict_code", input.subdistrictCode);
}

export async function updateRegionRate(supabase: Client, tenantId: string, input: RegionRate) {
  return supabase
    .from("regions")
    .update({ rate_per_acre: input.ratePerAcre }, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("id", input.regionId);
}
