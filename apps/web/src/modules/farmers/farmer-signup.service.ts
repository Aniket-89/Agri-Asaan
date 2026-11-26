import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { FarmerSignupInput } from "./farmer.schema";

// Farmer self-registration on an organization's site (ADR 0018). The
// organization comes from the verified hostname inside the database; the
// role is always farmer.

export type SignupVillage = { id: string; name: string; regionName: string };

export type FarmerSignupError = "closed" | "invalid" | "already_member";

export type FarmerSignupResult = { ok: true } | { ok: false; error: FarmerSignupError };

// Villages offered on the sign-up form. Empty when the site does not accept
// farmer sign-ups, which is how pages decide whether to show the form.
export async function listSignupVillages(
  supabase: SupabaseClient<Database>,
  hostname: string | null
): Promise<SignupVillage[]> {
  if (!hostname) {
    return [];
  }
  const { data, error } = await supabase.rpc("get_farmer_registration_villages", {
    p_hostname: hostname,
  });
  if (error) {
    throw new Error("Unable to load registration villages.");
  }
  return (data ?? []).map((row) => ({
    id: row.village_id,
    name: row.village_name,
    regionName: row.region_name,
  }));
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
    p_village_id: input.villageId,
    p_full_name: input.fullName,
    p_phone: input.phone,
  });
  return error ? { ok: false, error: toSignupError(error) } : { ok: true };
}
