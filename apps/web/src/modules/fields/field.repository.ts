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
      "id, name, area_acres, latitude, longitude, is_active, crop:tenant_crops!fields_crop_same_tenant(name_en, name_hi)"
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
