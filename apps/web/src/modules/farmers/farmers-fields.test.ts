import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { escapeLikePattern, toDomainError } from "@/lib/utils/db-errors";
import { fieldInputSchema } from "@/modules/fields/field.schema";
import { canWorkWithFarmers } from "./farmer.permissions";
import { farmerInputSchema, farmerSearchSchema, normalizeIndianMobile } from "./farmer.schema";

const ID = "e3000000-0000-4000-8000-000000000009";
const VILLAGE = "e2000000-0000-4000-8000-000000000001";
const CROP = "e5000000-0000-4000-8000-000000000001";

describe("normalizeIndianMobile", () => {
  it.each([
    ["98765 43210", "9876543210"],
    ["+91 98765-43210", "9876543210"],
    ["09876543210", "9876543210"],
    ["919876543210", "9876543210"],
    ["(98765) 43210", "9876543210"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });
});

describe("farmerInputSchema", () => {
  const valid = {
    id: ID,
    villageId: VILLAGE,
    fullName: " Demo Farmer ",
    phone: "+91 90000 00101",
    consent: "on",
  };

  it("accepts a complete registration and normalizes it", () => {
    expect(farmerInputSchema.parse(valid)).toEqual({
      id: ID,
      villageId: VILLAGE,
      fullName: "Demo Farmer",
      phone: "9000000101",
      consent: "on",
    });
  });

  it("requires the farmer's consent", () => {
    expect(farmerInputSchema.safeParse({ ...valid, consent: null }).success).toBe(false);
  });

  it("rejects numbers that are not Indian mobiles", () => {
    expect(farmerInputSchema.safeParse({ ...valid, phone: "1234567890" }).success).toBe(false);
    expect(farmerInputSchema.safeParse({ ...valid, phone: "98765" }).success).toBe(false);
  });
});

describe("farmerSearchSchema", () => {
  it("trims and caps search text", () => {
    expect(farmerSearchSchema.parse({ q: "  ramesh " })).toEqual({ q: "ramesh" });
    expect(farmerSearchSchema.parse({})).toEqual({ q: undefined });
    expect(farmerSearchSchema.safeParse({ q: "x".repeat(61) }).success).toBe(false);
  });
});

describe("fieldInputSchema", () => {
  const valid = {
    farmerId: ID,
    name: "Canal-side plot",
    cropId: CROP,
    areaAcres: "3.5",
    latitude: "29.002",
    longitude: "77.003",
  };

  it("accepts a field with a pin", () => {
    expect(fieldInputSchema.parse(valid)).toMatchObject({ areaAcres: 3.5, latitude: 29.002 });
  });

  it("requires a pin and a positive area with at most two decimals", () => {
    expect(fieldInputSchema.safeParse({ ...valid, latitude: "" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...valid, areaAcres: "0" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...valid, areaAcres: "1.234" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...valid, areaAcres: "2.25" }).success).toBe(true);
  });
});

describe("canWorkWithFarmers", () => {
  it("allows admins and mitras, not farmers or pilots", () => {
    expect(canWorkWithFarmers("organization_admin")).toBe(true);
    expect(canWorkWithFarmers("regional_admin")).toBe(true);
    expect(canWorkWithFarmers("mitra")).toBe(true);
    expect(canWorkWithFarmers("farmer")).toBe(false);
    expect(canWorkWithFarmers("pilot")).toBe(false);
  });
});

describe("db error helpers", () => {
  const error = (code: string) => ({ code, message: "", details: "", hint: "" }) as PostgrestError;

  it("maps expected rejections and throws on the unexpected", () => {
    expect(toDomainError(error("23505"))).toBe("duplicate");
    expect(toDomainError(error("42501"))).toBe("forbidden");
    expect(() => toDomainError(error("57014"))).toThrow();
  });

  it("escapes LIKE wildcards in search text", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
