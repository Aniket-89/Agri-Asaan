import { describe, expect, it } from "vitest";

import {
  pilotAvailabilityInputSchema,
  pilotProfileInputSchema,
} from "@/modules/pilots/pilot.schema";
import { droneInputSchema, droneStatusInputSchema } from "./drone.schema";
import { canManageFleetItem, canViewFleet } from "./fleet.permissions";

const REGION = "e1000000-0000-4000-8000-000000000001";
const OTHER = "e1000000-0000-4000-8000-000000000002";
const USER = "d0000000-0000-4000-8000-000000000008";

describe("droneInputSchema", () => {
  it("upper-cases the UID and treats an empty region as none", () => {
    expect(
      droneInputSchema.parse({ uid: " ua-demo-09 ", model: " Sprayer ", homeRegionId: "" })
    ).toEqual({
      uid: "UA-DEMO-09",
      model: "Sprayer",
    });
  });

  it("rejects malformed UIDs", () => {
    expect(droneInputSchema.safeParse({ uid: "a b", model: "X" }).success).toBe(false);
    expect(droneInputSchema.safeParse({ uid: "-UA1", model: "X" }).success).toBe(false);
    expect(droneInputSchema.safeParse({ uid: "UA", model: "X" }).success).toBe(false);
  });

  it("accepts only known statuses", () => {
    expect(
      droneStatusInputSchema.safeParse({ droneId: REGION, status: "maintenance" }).success
    ).toBe(true);
    expect(droneStatusInputSchema.safeParse({ droneId: REGION, status: "lost" }).success).toBe(
      false
    );
  });
});

describe("pilot schemas", () => {
  it("normalizes the licence number and allows it to be omitted", () => {
    expect(
      pilotProfileInputSchema.parse({ userId: USER, homeRegionId: REGION, licenseNumber: "rpc-01" })
    ).toEqual({
      userId: USER,
      homeRegionId: REGION,
      licenseNumber: "RPC-01",
    });
    expect(
      pilotProfileInputSchema.parse({ userId: USER, homeRegionId: "", licenseNumber: "" })
    ).toEqual({
      userId: USER,
    });
  });

  it("parses availability from the form", () => {
    expect(pilotAvailabilityInputSchema.parse({ userId: USER, isActive: "false" })).toEqual({
      userId: USER,
      isActive: false,
    });
    expect(pilotAvailabilityInputSchema.safeParse({ userId: USER, isActive: "yes" }).success).toBe(
      false
    );
  });
});

describe("fleet permissions", () => {
  const assigned = new Set([REGION]);

  it("lets admins view the fleet, not mitras, pilots, or farmers", () => {
    expect(canViewFleet("organization_admin")).toBe(true);
    expect(canViewFleet("regional_admin")).toBe(true);
    expect(canViewFleet("mitra")).toBe(false);
    expect(canViewFleet("pilot")).toBe(false);
  });

  it("limits regional admins to items homed in their regions", () => {
    expect(canManageFleetItem("regional_admin", REGION, assigned)).toBe(true);
    expect(canManageFleetItem("regional_admin", OTHER, assigned)).toBe(false);
    expect(canManageFleetItem("regional_admin", null, assigned)).toBe(false);
    expect(canManageFleetItem("organization_admin", null, new Set())).toBe(true);
  });
});
