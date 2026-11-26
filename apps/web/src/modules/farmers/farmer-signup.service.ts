import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { listPlaces, type Places } from "@/modules/places";

import type { FarmerSignupInput } from "./farmer.schema";

// Farmer self-registration on an organization's site (ADR 0018). The
// organization comes from the verified hostname inside the database; the
// role is always farmer.

export type SignupVillage = { id: string; name: string; regionName: string };

export type FarmerSignupError = "closed" | "invalid" | "already_member";

export type FarmerSignupResult = { ok: true } | { ok: false; error: FarmerSignupError };

export type SignupOptions = { open: boolean; villages: SignupVillage[]; places: Places };

// Whether the site takes farmer sign-ups, and the villages a farmer may pick
// (optional: farmers whose village is not listed register by address).
export async function getSignupOptions(
  supabase: SupabaseClient<Database>,
  hostname: string | null
): Promise<SignupOptions> {
  if (!hostname) {
    return { open: false, villages: [], places: { districts: [], tehsils: [] } };
  }
  const [openResult, villagesResult, places] = await Promise.all([
    supabase.rpc("farmer_registration_open", { p_hostname: hostname }),
    supabase.rpc("get_farmer_registration_villages", { p_hostname: hostname }),
    listPlaces(supabase),
  ]);
  if (openResult.error || villagesResult.error) {
    throw new Error("Unable to load registration options.");
  }
  return {
    open: openResult.data === true,
    places,
    villages: (villagesResult.data ?? []).map((row) => ({
      id: row.village_id,
      name: row.village_name,
      regionName: row.region_name,
    })),
  };
}

function toSignupError(error: PostgrestError): FarmerSignupError {
  switch (error.code) {
    case "42501":
      return "closed";
    case "22023":
    case "23514":
      return "invalid";
    case "23505":
      return "already_member";
    default:
      throw new Error(`Unexpected database error (${error.code}).`);
  }
}

// The signed-in caller joins the site's organization as a farmer.
export async function registerSelfAsFarmer(
  supabase: SupabaseClient<Database>,
  hostname: string | null,
  input: FarmerSignupInput
): Promise<FarmerSignupResult> {
  if (!hostname) {
    return { ok: false, error: "closed" };
  }
  const { error } = await supabase.rpc("register_self_as_farmer", {
    p_hostname: hostname,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_subdistrict_code: input.subdistrictCode,
    p_locality: input.locality,
    p_address_line: input.addressLine,
    p_pincode: input.pincode,
    p_village_id: input.villageId,
  });
  return error ? { ok: false, error: toSignupError(error) } : { ok: true };
}
