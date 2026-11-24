import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { PilotAvailabilityInput } from "./pilot.schema";

type Client = SupabaseClient<Database>;

export async function listPilotMembers(supabase: Client, tenantId: string) {
  return supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", tenantId)
    .eq("role", "pilot");
}

export async function listPilotProfiles(supabase: Client, tenantId: string) {
  return supabase
    .from("pilot_profiles")
    .select("user_id, home_region_id, license_number, is_active")
    .eq("tenant_id", tenantId);
}

export async function listProfileNames(supabase: Client, profileIds: string[]) {
  return supabase.from("profiles").select("id, full_name").in("id", profileIds);
}

export async function updatePilotAvailability(
  supabase: Client,
  tenantId: string,
  input: PilotAvailabilityInput
) {
  return supabase
    .from("pilot_profiles")
    .update({ is_active: input.isActive, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("user_id", input.userId);
}
