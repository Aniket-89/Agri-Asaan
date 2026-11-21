import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { canManageRegion, canManageRegions, canViewTerritoryAdmin } from "./territory.permissions";
import { regionInputSchema, villageInputSchema } from "./territory.schema";
import { toTerritoryError } from "./territory.service";

const REGION_ID = "e1000000-0000-4000-8000-000000000001";

describe("villageInputSchema", () => {
  it("accepts a village with a pin and treats empty optional fields as absent", () => {
    expect(
      villageInputSchema.parse({
        regionId: REGION_ID,
        name: "  Demo Village  ",
        lgdCode: "",
        latitude: "29.05",
        longitude: "77.05",
      })
    ).toEqual({ regionId: REGION_ID, name: "Demo Village", latitude: 29.05, longitude: 77.05 });

    expect(
      villageInputSchema.parse({ regionId: REGION_ID, name: "No pin", latitude: "", longitude: "" })
    ).toEqual({ regionId: REGION_ID, name: "No pin" });
  });

  it("requires latitude and longitude together and within range", () => {
    expect(
      villageInputSchema.safeParse({ regionId: REGION_ID, name: "Half", latitude: "29" }).success
    ).toBe(false);
    expect(
      villageInputSchema.safeParse({
        regionId: REGION_ID,
        name: "Off map",
        latitude: "91",
        longitude: "77",
      }).success
    ).toBe(false);
  });

  it("rejects malformed LGD codes and region ids", () => {
    expect(
      villageInputSchema.safeParse({ regionId: REGION_ID, name: "X", lgdCode: "12a" }).success
    ).toBe(false);
    expect(villageInputSchema.safeParse({ regionId: "not-a-uuid", name: "X" }).success).toBe(false);
  });
});

describe("regionInputSchema", () => {
  it("trims and rejects blank names", () => {
    expect(regionInputSchema.parse({ name: " North " })).toEqual({ name: "North" });
    expect(regionInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("territory permissions", () => {
  it("lets only organization and regional admins open the territory screen", () => {
    expect(canViewTerritoryAdmin("organization_admin")).toBe(true);
    expect(canViewTerritoryAdmin("regional_admin")).toBe(true);
    expect(canViewTerritoryAdmin("mitra")).toBe(false);
    expect(canViewTerritoryAdmin("farmer")).toBe(false);
  });

  it("limits regional admins to their assigned regions", () => {
    const assigned = new Set([REGION_ID]);
    expect(canManageRegions("regional_admin")).toBe(false);
    expect(canManageRegion("regional_admin", REGION_ID, assigned)).toBe(true);
    expect(canManageRegion("regional_admin", "other-region", assigned)).toBe(false);
    expect(canManageRegion("organization_admin", "other-region", new Set())).toBe(true);
    expect(canManageRegion("pilot", REGION_ID, assigned)).toBe(false);
  });
});

describe("toTerritoryError", () => {
  const error = (code: string) => ({ code, message: "", details: "", hint: "" }) as PostgrestError;

  it("maps expected database rejections", () => {
    expect(toTerritoryError(error("23505"))).toBe("duplicate");
    expect(toTerritoryError(error("23514"))).toBe("invalid");
    expect(toTerritoryError(error("23503"))).toBe("invalid");
    expect(toTerritoryError(error("42501"))).toBe("forbidden");
  });

  it("throws on unexpected errors instead of hiding them", () => {
    expect(() => toTerritoryError(error("08006"))).toThrow();
  });
});
