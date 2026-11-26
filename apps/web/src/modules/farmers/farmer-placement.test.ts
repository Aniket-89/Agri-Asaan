import { describe, expect, it, vi } from "vitest";

import { farmerPlacementSchema, farmerSignupSchema } from "./farmer.schema";
import {
  listPlacementVillages,
  placeFarmer,
  type FarmerContext,
  type FarmerDetail,
} from "./farmer.service";

const REGION_A = "e1000000-0000-4000-8000-000000000001";
const REGION_B = "e1000000-0000-4000-8000-000000000002";
const VILLAGE_ID = "e2000000-0000-4000-8000-000000000001";
const FARMER_ID = "f1000000-0000-4000-8000-000000000001";

const villages = [
  { id: "v-a1", name: "Alpha", region_id: REGION_A, is_active: true },
  { id: "v-b1", name: "Gamma", region_id: REGION_B, is_active: true },
];

// A query-builder stand-in: every chained call returns itself, and awaiting
// it resolves to `result`.
function builder(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "update"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => void) => resolve(result);
  return chain;
}

function context(role: FarmerContext["role"], result: unknown): FarmerContext {
  return {
    role,
    organizationId: "tenant-id",
    userId: "user-id",
    supabase: { from: vi.fn(() => builder(result)) },
  } as unknown as FarmerContext;
}

function farmer(overrides: Partial<FarmerDetail> = {}): FarmerDetail {
  return {
    id: FARMER_ID,
    fullName: "Fake Farmer",
    phone: "9876500001",
    villageName: null,
    villageId: null,
    regionId: REGION_A,
    regionName: "North",
    hasRegion: true,
    locality: "Fake Town",
    pincode: "281001",
    addressLine: "Near the fake well",
    villageLocation: null,
    isActive: true,
    createdAt: "2026-11-27T00:00:00Z",
    ...overrides,
  };
}

describe("listPlacementVillages", () => {
  it("offers only the villages of the farmer's region", async () => {
    const options = await listPlacementVillages(
      context("regional_admin", { data: villages, error: null }),
      farmer()
    );
    expect(options).toEqual([{ id: "v-a1", name: "Alpha" }]);
  });

  it("lets an organization admin place a farmer with no region anywhere", async () => {
    const options = await listPlacementVillages(
      context("organization_admin", { data: villages, error: null }),
      farmer({ regionId: null, hasRegion: false })
    );
    expect(options.map((village) => village.id)).toEqual(["v-a1", "v-b1"]);
  });

  it("offers nothing to mitras or for farmers who already have a village", async () => {
    expect(
      await listPlacementVillages(context("mitra", { data: villages, error: null }), farmer())
    ).toEqual([]);
    expect(
      await listPlacementVillages(
        context("regional_admin", { data: villages, error: null }),
        farmer({ villageId: VILLAGE_ID, villageName: "Alpha" })
      )
    ).toEqual([]);
  });
});

describe("placeFarmer", () => {
  const input = { farmerId: FARMER_ID, villageId: VILLAGE_ID };

  it("refuses mitras before touching the database", async () => {
    const ctx = context("mitra", { error: null, count: 1 });
    await expect(placeFarmer(ctx, input)).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(ctx.supabase.from).not.toHaveBeenCalled();
  });

  it("places the farmer", async () => {
    await expect(
      placeFarmer(context("regional_admin", { error: null, count: 1 }), input)
    ).resolves.toEqual({ ok: true });
  });

  it("reports a farmer already placed or out of reach as not found", async () => {
    await expect(
      placeFarmer(context("regional_admin", { error: null, count: 0 }), input)
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });

  it("maps a database refusal to forbidden", async () => {
    await expect(
      placeFarmer(context("regional_admin", { error: { code: "42501" }, count: null }), input)
    ).resolves.toEqual({ ok: false, error: "forbidden" });
  });
});

describe("farmer address schemas", () => {
  const signup = {
    fullName: "Fake Farmer",
    phone: "98765 00001",
    pincode: " 281001 ",
    locality: "Fake Town",
    addressLine: "Near the fake well",
    consent: "on",
  };

  it("accepts an address without a listed village", () => {
    const parsed = farmerSignupSchema.parse({ ...signup, villageId: "" });
    expect(parsed.villageId).toBeUndefined();
    expect(parsed.pincode).toBe("281001");
  });

  it("rejects pincodes that start with 0 or are not six digits", () => {
    expect(farmerSignupSchema.safeParse({ ...signup, pincode: "012345" }).success).toBe(false);
    expect(farmerSignupSchema.safeParse({ ...signup, pincode: "28100" }).success).toBe(false);
  });

  it("requires a farmer and a village to place", () => {
    expect(farmerPlacementSchema.safeParse({ farmerId: FARMER_ID }).success).toBe(false);
  });
});
