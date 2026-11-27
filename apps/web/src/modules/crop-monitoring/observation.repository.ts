import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

// Passes kept per field on screen: the MVP shows a narrow history.
export const PASSES_PER_FIELD = 8;
export const PIXEL_BUCKET = "field-rasters";

// Newest first. RLS limits rows to fields the caller can read.
export async function listObservations(supabase: Client, tenantId: string, fieldIds: string[]) {
  return supabase
    .from("field_observations")
    .select(
      "id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean, raster_path"
    )
    .eq("tenant_id", tenantId)
    .in("field_id", fieldIds)
    .order("observed_at", { ascending: false })
    .limit(fieldIds.length * PASSES_PER_FIELD * 3);
}

export async function getScanStatus(supabase: Client, tenantId: string, fieldId: string) {
  return supabase
    .from("field_scan_status")
    .select("last_checked_at, last_error")
    .eq("tenant_id", tenantId)
    .eq("field_id", fieldId)
    .maybeSingle();
}

// With the caller's session: Storage RLS allows only files of fields the
// caller can read.
export async function downloadPixelFile(supabase: Client, path: string) {
  return supabase.storage.from(PIXEL_BUCKET).download(path);
}
