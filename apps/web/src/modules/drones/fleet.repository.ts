import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { DroneInput, DroneStatusInput } from "./drone.schema";

type Client = SupabaseClient<Database>;

// Queries shared by the drones and pilots modules. All run with the caller's
// session, so RLS scopes every result.

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

export async function listDrones(supabase: Client, tenantId: string) {
  return supabase
    .from("drones")
    .select("id, uid, model, status, home_region_id")
    .eq("tenant_id", tenantId)
    .order("uid");
}

export async function insertDrone(supabase: Client, tenantId: string, input: DroneInput) {
  return supabase.from("drones").insert({
    tenant_id: tenantId,
    uid: input.uid,
    model: input.model,
    home_region_id: input.homeRegionId ?? null,
  });
}

export async function updateDroneStatus(
  supabase: Client,
  tenantId: string,
  input: DroneStatusInput
) {
  return supabase
    .from("drones")
    .update({ status: input.status, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("id", input.droneId);
}
