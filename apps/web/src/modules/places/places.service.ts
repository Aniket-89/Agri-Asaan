import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

// Official places (Local Government Directory) shared by every organization:
// districts and their tehsils (ADR 0023). Public reference data, readable
// without signing in.

export type DistrictOption = { code: number; name: string; stateName: string };
export type TehsilOption = { code: number; name: string; districtCode: number };
export type Places = { districts: DistrictOption[]; tehsils: TehsilOption[] };

// The API returns at most 1,000 rows per request; tehsils are read in pages.
const PAGE_SIZE = 1000;

async function listAllTehsils(supabase: SupabaseClient<Database>) {
  const rows: { code: number; name: string; district_code: number }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("geo_subdistricts")
      .select("code, name, district_code")
      .order("code")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error("Unable to load places.");
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
}

export async function listPlaces(supabase: SupabaseClient<Database>): Promise<Places> {
  const [districts, tehsilRows] = await Promise.all([
    supabase
      .from("geo_districts")
      .select("code, name, state:geo_states!geo_districts_state_code_fkey(name)")
      .order("name"),
    listAllTehsils(supabase),
  ]);
  if (districts.error) {
    throw new Error("Unable to load places.");
  }
  const tehsils = { data: tehsilRows };
  return {
    districts: districts.data
      .map((row) => ({ code: row.code, name: row.name, stateName: row.state?.name ?? "" }))
      .sort((a, b) => a.stateName.localeCompare(b.stateName) || a.name.localeCompare(b.name)),
    tehsils: tehsils.data.map((row) => ({
      code: row.code,
      name: row.name,
      districtCode: row.district_code,
    })),
  };
}
