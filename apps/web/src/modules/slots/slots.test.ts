import { describe, expect, it } from "vitest";

import { slotActiveInputSchema, slotInputSchema } from "./slot.schema";
import { canManageSlots } from "./slot.service";

describe("slotInputSchema", () => {
  const valid = { nameEn: " Morning ", nameHi: " सुबह ", startTime: "09:00", endTime: "11:30" };

  it("accepts a slot and trims names", () => {
    expect(slotInputSchema.parse(valid)).toEqual({
      nameEn: "Morning",
      nameHi: "सुबह",
      startTime: "09:00",
      endTime: "11:30",
    });
  });

  it("requires the slot to end after it starts and valid times", () => {
    expect(slotInputSchema.safeParse({ ...valid, endTime: "08:00" }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...valid, endTime: "09:00" }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...valid, startTime: "25:00" }).success).toBe(false);
  });

  it("parses activation toggles", () => {
    expect(
      slotActiveInputSchema.parse({
        slotId: "e7000000-0000-4000-8000-000000000001",
        isActive: "false",
      })
    ).toEqual({ slotId: "e7000000-0000-4000-8000-000000000001", isActive: false });
  });
});

describe("canManageSlots", () => {
  it("is limited to organization admins", () => {
    expect(canManageSlots("organization_admin")).toBe(true);
    expect(canManageSlots("regional_admin")).toBe(false);
    expect(canManageSlots("mitra")).toBe(false);
  });
});
