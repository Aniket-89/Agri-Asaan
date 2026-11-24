import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/lib/i18n";
import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { OrganizationRole } from "@/modules/organizations";
import { canWorkWithFarmers } from "@/modules/farmers";
import type { Database } from "@/types/database.types";
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
