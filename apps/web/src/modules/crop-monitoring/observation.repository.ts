import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

// Passes kept per field on screen: the MVP shows a narrow history.
export const PASSES_PER_FIELD = 8;

// Newest first. RLS limits rows to fields the caller can read.
export async function listObservations(supabase: Client, tenantId: string, fieldIds: string[]) {
  return supabase
    .from("field_observations")
    .select(
      "id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean"
    )
    .eq("tenant_id", tenantId)
    .in("field_id", fieldIds)
    .order("observed_at", { ascending: false })
    .limit(fieldIds.length * PASSES_PER_FIELD * 2);
}
