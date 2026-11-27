import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { IndexKind } from "./indices";
import * as repository from "./observation.repository";

export type CropHealthContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
};

export type ObservationQuality = "good" | "partly_cloudy" | "cloudy";
export type ObservationSource = "simulated-demo" | "sentinel-2-l2a";

export type Observation = {
  id: string;
  observedAt: string;
  source: ObservationSource;
  processingVersion: string;
  cloudCoverPct: number;
  quality: ObservationQuality;
  // Null on cloudy passes.
  values: Record<IndexKind, number | null>;
};

export type FieldHealth = {
  // Newest first, at most PASSES_PER_FIELD.
  observations: Observation[];
  // The newest pass with usable values, or null.
  latestClear: Observation | null;
};

const QUALITIES: readonly ObservationQuality[] = ["good", "partly_cloudy", "cloudy"];
const SOURCES: readonly ObservationSource[] = ["simulated-demo", "sentinel-2-l2a"];

const toNumber = (value: number | null) => (value === null ? null : Number(value));

// Crop health of each field, keyed by field id. Fields without observations
// are absent.
export async function listFieldHealth(
  context: CropHealthContext,
  fieldIds: string[]
): Promise<Map<string, FieldHealth>> {
  const health = new Map<string, FieldHealth>();
  if (fieldIds.length === 0) {
    return health;
  }
  const { data, error } = await repository.listObservations(
    context.supabase,
    context.organizationId,
    fieldIds
  );
  if (error) {
    throw new Error("Unable to load crop health.");
  }
  for (const row of data) {
    if (
      !QUALITIES.includes(row.quality as ObservationQuality) ||
      !SOURCES.includes(row.source as ObservationSource)
    ) {
      continue;
    }
    const entry = health.get(row.field_id) ?? { observations: [], latestClear: null };
    if (entry.observations.length >= repository.PASSES_PER_FIELD) {
      continue;
    }
    const observation: Observation = {
      id: row.id,
      observedAt: row.observed_at,
      source: row.source as ObservationSource,
      processingVersion: row.processing_version,
      cloudCoverPct: Number(row.cloud_cover_pct),
      quality: row.quality as ObservationQuality,
      values: {
        ndvi: toNumber(row.ndvi_mean),
        ndre: toNumber(row.ndre_mean),
        ndmi: toNumber(row.ndmi_mean),
      },
    };
    entry.observations.push(observation);
    if (!entry.latestClear && observation.quality !== "cloudy") {
      entry.latestClear = observation;
    }
    health.set(row.field_id, entry);
  }
  return health;
}
