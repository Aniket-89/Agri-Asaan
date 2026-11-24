import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { availableBookingActions, bookingDateWindow, type BookingActor } from "./booking.rules";
import { bookingStatusChangeSchema, createBookingSchema } from "./booking.schema";
import { formatSlotLabel, toBookingError } from "./booking.service";

const nobody: BookingActor = { isRegionManager: false, isRequester: false, isFarmer: false };
const ID = "e6000000-0000-4000-8000-000000000009";
const FARMER = "e3000000-0000-4000-8000-000000000001";
const FIELD = "e4000000-0000-4000-8000-000000000001";
const SLOT = "e7000000-0000-4000-8000-000000000001";

describe("availableBookingActions (mirrors set_booking_status)", () => {
  it("lets a region manager confirm, reject, or cancel a requested booking", () => {
    expect(availableBookingActions("requested", { ...nobody, isRegionManager: true })).toEqual([
      "confirm",
      "reject",
      "cancel",
    ]);
  });

  it("lets the requester or farmer only cancel while requested", () => {
    expect(availableBookingActions("requested", { ...nobody, isRequester: true })).toEqual([
      "cancel",
    ]);
    expect(availableBookingActions("requested", { ...nobody, isFarmer: true })).toEqual(["cancel"]);
    expect(availableBookingActions("confirmed", { ...nobody, isRequester: true })).toEqual([]);
  });

  it("lets only a region manager cancel a confirmed booking", () => {
    expect(availableBookingActions("confirmed", { ...nobody, isRegionManager: true })).toEqual([
      "cancel",
    ]);
  });

  it("offers nothing on closed bookings or to bystanders", () => {
    expect(availableBookingActions("cancelled", { ...nobody, isRegionManager: true })).toEqual([]);
    expect(availableBookingActions("rejected", { ...nobody, isRegionManager: true })).toEqual([]);
    expect(availableBookingActions("requested", nobody)).toEqual([]);
  });
});

describe("bookingDateWindow", () => {
  it("uses the date in India, not UTC", () => {
    // 20:00 UTC on 24 Nov is 01:30 on 25 Nov in India.
    expect(bookingDateWindow(new Date("2026-11-24T20:00:00Z"))).toEqual({
      min: "2026-11-25",
      max: "2027-01-24",
    });
  });

  it("spans 60 days across month and year boundaries", () => {
    expect(bookingDateWindow(new Date("2026-12-31T06:00:00Z"))).toEqual({
      min: "2026-12-31",
      max: "2027-03-01",
    });
  });
});

describe("createBookingSchema", () => {
  const valid = {
    id: ID,
    farmerId: FARMER,
    fieldIds: [FIELD],
    preferredDate: "2026-11-27",
    slotId: SLOT,
    notes: "  ",
  };

  it("accepts a booking and drops blank notes", () => {
    expect(createBookingSchema.parse(valid)).toEqual({
      id: ID,
      farmerId: FARMER,
      fieldIds: [FIELD],
      preferredDate: "2026-11-27",
      slotId: SLOT,
    });
  });

  it("requires at least one field and a real date", () => {
    expect(createBookingSchema.safeParse({ ...valid, fieldIds: [] }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...valid, preferredDate: "27/11/2026" }).success).toBe(
      false
    );
    expect(createBookingSchema.safeParse({ ...valid, preferredDate: "2026-02-30" }).success).toBe(
      false
    );
  });

  it("caps notes at 500 characters", () => {
    expect(createBookingSchema.safeParse({ ...valid, notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("bookingStatusChangeSchema", () => {
  it("accepts only the transitions the UI can request", () => {
    expect(
      bookingStatusChangeSchema.safeParse({ bookingId: ID, toStatus: "confirmed" }).success
    ).toBe(true);
    expect(
      bookingStatusChangeSchema.safeParse({ bookingId: ID, toStatus: "verified" }).success
    ).toBe(false);
  });
});

describe("toBookingError", () => {
  const error = (code: string, hint = "") =>
    ({ code, hint, message: "", details: "" }) as PostgrestError;

  it("maps database rule hints to specific errors", () => {
    expect(toBookingError(error("23514", "field_already_booked"))).toBe("field_already_booked");
    expect(toBookingError(error("23514", "reason_required"))).toBe("reason_required");
    expect(toBookingError(error("23514", "date_out_of_range"))).toBe("date_out_of_range");
  });

  it("falls back to generic errors", () => {
    expect(toBookingError(error("23514", "something_else"))).toBe("invalid");
    expect(toBookingError(error("42501"))).toBe("forbidden");
    expect(toBookingError(error("P0002"))).toBe("not_found");
    expect(() => toBookingError(error("08006"))).toThrow();
  });
});

describe("slots in bookings", () => {
  it("requires a slot", () => {
    expect(
      createBookingSchema.safeParse({
        id: ID,
        farmerId: FARMER,
        fieldIds: [FIELD],
        preferredDate: "2026-11-27",
      }).success
    ).toBe(false);
  });

  it("formats a slot label in the viewer's language", () => {
    const slot = {
      name_en: "Morning",
      name_hi: "सुबह",
      start_time: "09:00:00",
      end_time: "11:30:00",
    };
    expect(formatSlotLabel(slot, "en")).toBe("Morning · 09:00–11:30");
    expect(formatSlotLabel(slot, "hi")).toBe("सुबह · 09:00–11:30");
  });

  it("maps slot rule hints", () => {
    const error = (hint: string) =>
      ({ code: "23514", hint, message: "", details: "" }) as PostgrestError;
    expect(toBookingError(error("slot_full"))).toBe("slot_full");
    expect(toBookingError(error("invalid_slot"))).toBe("invalid_slot");
  });
});
