import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/lib/i18n";
import { toPolygon, type GeoPolygon, type MapPin } from "@/lib/maps/geo";
import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { OrganizationRole } from "@/modules/organizations";
import { canWorkWithFarmers } from "@/modules/farmers";
import type { Database } from "@/types/database.types";
import { DONE_STATUSES, fieldTone, OPEN_STATUSES } from "./field-map.rules";
import * as repository from "./field.repository";
import type { FieldInput } from "./field.schema";

export type FieldContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  role: OrganizationRole;
};

export type CropOption = { id: string; name: string };

export type FieldItem = {
  id: string;
  name: string;
  cropName: string;
  areaAcres: number;
  latitude: number;
  longitude: number;
  boundary: GeoPolygon | null;
  isActive: boolean;
};

export type FieldResult = { ok: true } | { ok: false; error: DomainErrorCode };

const cropName = (crop: { name_en: string; name_hi: string }, locale: Locale) =>
  locale === "hi" ? crop.name_hi : crop.name_en;

export async function listCropOptions(
  context: FieldContext,
  locale: Locale
): Promise<CropOption[]> {
  const { data, error } = await repository.listActiveCrops(
    context.supabase,
    context.organizationId
  );
  if (error) {
    throw new Error("Unable to load crops.");
  }
  return data.map((crop) => ({ id: crop.id, name: cropName(crop, locale) }));
}

export async function listFarmerFields(
  context: FieldContext,
  farmerId: string,
  locale: Locale
): Promise<FieldItem[]> {
  const { data, error } = await repository.listFieldsForFarmer(
    context.supabase,
    context.organizationId,
    farmerId
  );
  if (error) {
    throw new Error("Unable to load fields.");
  }
  return data.map((field) => ({
    id: field.id,
    name: field.name,
    cropName: field.crop ? cropName(field.crop, locale) : "",
    areaAcres: field.area_acres,
    latitude: field.latitude,
    longitude: field.longitude,
    boundary: toPolygon(field.boundary_geojson),
    isActive: field.is_active,
  }));
}

export async function addField(context: FieldContext, input: FieldInput): Promise<FieldResult> {
  if (!canWorkWithFarmers(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await repository.insertField(context.supabase, context.organizationId, input);
  return error ? { ok: false, error: toDomainError(error) } : { ok: true };
}

// Organization admins see every region; regional admins see theirs.
export function canViewFieldMap(role: OrganizationRole): boolean {
  return role === "organization_admin" || role === "regional_admin";
}

export type RegionOption = { id: string; name: string };

export async function listMapRegions(
  context: FieldContext & { userId: string }
): Promise<RegionOption[] | null> {
  if (!canViewFieldMap(context.role)) {
    return null;
  }
  const regions = await repository.listRegions(context.supabase, context.organizationId);
  if (regions.error) {
    throw new Error("Unable to load regions.");
  }
  if (context.role === "organization_admin") {
    return regions.data;
  }
  const own = await repository.listOwnRegionIds(
    context.supabase,
    context.organizationId,
    context.userId
  );
  if (own.error) {
    throw new Error("Unable to load regions.");
  }
  const ownIds = new Set(own.data.map((row) => row.region_id));
  return regions.data.filter((region) => ownIds.has(region.id));
}

export type RegionMapPin = MapPin & { farmerName: string; villageName: string; areaAcres: number };

const RECENT_DAYS = 30;

// Fields of a region as map pins, coloured by booking status: open booking,
// sprayed in the last 30 days, or neither.
export async function listRegionMapPins(
  context: FieldContext,
  regionId: string,
  today: string
): Promise<{ pins: RegionMapPin[]; truncated: boolean }> {
  const [year, month, day] = today.split("-").map(Number);
  const since = new Date(Date.UTC(year, month - 1, day - RECENT_DAYS)).toISOString().slice(0, 10);
  const [fields, lines] = await Promise.all([
    repository.listRegionFields(context.supabase, context.organizationId, regionId),
    repository.listRegionBookingLines(
      context.supabase,
      context.organizationId,
      regionId,
      [...OPEN_STATUSES, ...DONE_STATUSES],
      since
    ),
  ]);
  if (fields.error || lines.error) {
    throw new Error("Unable to load the field map.");
  }
  const statuses = new Map<string, string[]>();
  for (const line of lines.data) {
    if (line.booking) {
      statuses.set(line.field_id, [...(statuses.get(line.field_id) ?? []), line.booking.status]);
    }
  }
  return {
    pins: fields.data.map((field) => ({
      id: field.id,
      label: field.name,
      latitude: field.latitude,
      longitude: field.longitude,
      boundary: toPolygon(field.boundary_geojson),
      tone: fieldTone(statuses.get(field.id) ?? []),
      farmerName: field.farmer?.full_name ?? "",
      villageName: field.farmer?.village?.name ?? "",
      areaAcres: field.area_acres,
    })),
    truncated: fields.data.length >= repository.REGION_MAP_FIELD_LIMIT,
  };
}
