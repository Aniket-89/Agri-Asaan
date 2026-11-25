import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { FieldInput } from "./field.schema";

type Client = SupabaseClient<Database>;

export async function listActiveCrops(supabase: Client, tenantId: string) {
  return supabase
    .from("tenant_crops")
    .select("id, code, name_en, name_hi")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name_en");
}

export async function listFieldsForFarmer(supabase: Client, tenantId: string, farmerId: string) {
  return supabase
    .from("fields")
    .select(
      "id, name, area_acres, latitude, longitude, is_active, boundary_geojson, crop:tenant_crops!fields_crop_same_tenant(name_en, name_hi)"
    )
    .eq("tenant_id", tenantId)
    .eq("farmer_id", farmerId)
    .order("name");
}

export async function insertField(supabase: Client, tenantId: string, input: FieldInput) {
  return supabase.from("fields").insert({
    tenant_id: tenantId,
    farmer_id: input.farmerId,
    name: input.name,
    crop_id: input.cropId,
    area_acres: input.areaAcres,
    latitude: input.latitude,
    longitude: input.longitude,
  });
}

export const REGION_MAP_FIELD_LIMIT = 1000;

export async function listRegions(supabase: Client, tenantId: string) {
  return supabase.from("regions").select("id, name").eq("tenant_id", tenantId).order("name");
}

export async function listOwnRegionIds(supabase: Client, tenantId: string, userId: string) {
  return supabase
    .from("regional_admin_regions")
    .select("region_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
}

// Active fields of farmers whose village is in the region. RLS still decides
// which rows the caller may read.
export async function listRegionFields(supabase: Client, tenantId: string, regionId: string) {
  return supabase
    .from("fields")
    .select(
      "id, name, area_acres, latitude, longitude, boundary_geojson, farmer:farmers!fields_farmer_same_tenant!inner(full_name, village:villages!farmers_village_same_tenant!inner(name, region_id))"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("farmer.village.region_id", regionId)
    .order("name")
    .limit(REGION_MAP_FIELD_LIMIT);
}

// Booking lines in the region that are open, or were for a date on/after
// `since` (used to mark recently sprayed fields).
export async function listRegionBookingLines(
  supabase: Client,
  tenantId: string,
  regionId: string,
  statuses: readonly string[],
  since: string
) {
  return supabase
    .from("booking_fields")
    .select(
      "field_id, booking:bookings!booking_fields_booking_same_farmer!inner(status, preferred_date)"
    )
    .eq("tenant_id", tenantId)
    .eq("booking.region_id", regionId)
    .in("booking.status", [...statuses])
    .gte("booking.preferred_date", since);
}
