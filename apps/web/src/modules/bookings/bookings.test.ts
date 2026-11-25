import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/dictionaries/en";

import {
  availableBookingActions,
  bookingDateWindow,
  canAssignBooking,
  canStartJob,
  countByStatus,
  groupPilotJobs,
  type BookingActor,
  type BookingStatus,
} from "./booking.rules";
import {
  assignBookingSchema,
  bookingStatusChangeSchema,
  completeJobSchema,
  createBookingSchema,
} from "./booking.schema";
import { formatSlotLabel, toBookingError } from "./booking.service";
import { formatSprayed } from "./components/booking-ui";

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
    // assigned / completed only come from assign_booking and complete_job.
    for (const toStatus of ["assigned", "completed", "requested"]) {
      expect(bookingStatusChangeSchema.safeParse({ bookingId: ID, toStatus }).success).toBe(false);
    }
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

describe("assignment", () => {
  const PILOT = "d0000000-0000-4000-8000-000000000005";
  const DRONE = "e5000000-0000-4000-8000-000000000001";

  it("lets only region managers assign confirmed or reassign assigned bookings", () => {
    expect(canAssignBooking("confirmed", true)).toBe(true);
    expect(canAssignBooking("assigned", true)).toBe(true);
    expect(canAssignBooking("requested", true)).toBe(false);
    expect(canAssignBooking("cancelled", true)).toBe(false);
    expect(canAssignBooking("confirmed", false)).toBe(false);
  });

  it("lets only a region manager cancel an assigned booking", () => {
    expect(availableBookingActions("assigned", { ...nobody, isRegionManager: true })).toEqual([
      "cancel",
    ]);
    expect(
      availableBookingActions("assigned", { ...nobody, isRequester: true, isFarmer: true })
    ).toEqual([]);
  });

  it("requires a booking, a pilot, and a drone", () => {
    expect(
      assignBookingSchema.safeParse({ bookingId: ID, pilotUserId: PILOT, droneId: DRONE }).success
    ).toBe(true);
    expect(assignBookingSchema.safeParse({ bookingId: ID, pilotUserId: PILOT }).success).toBe(
      false
    );
    expect(
      assignBookingSchema.safeParse({ bookingId: ID, pilotUserId: "", droneId: DRONE }).success
    ).toBe(false);
  });

  it("maps assignment rule hints", () => {
    const error = (hint: string) =>
      ({ code: "23514", hint, message: "", details: "" }) as PostgrestError;
    for (const hint of [
      "pilot_busy",
      "drone_busy",
      "pilot_unavailable",
      "drone_unavailable",
      "slot_passed",
    ]) {
      expect(toBookingError(error(hint))).toBe(hint);
    }
  });
});

describe("job execution", () => {
  const FIELD_2 = "e4000000-0000-4000-8000-000000000002";

  it("lets the pilot start an assigned job only on its day", () => {
    expect(canStartJob("assigned", "2026-11-25", "2026-11-25")).toBe(true);
    expect(canStartJob("assigned", "2026-11-26", "2026-11-25")).toBe(false);
    expect(canStartJob("in_progress", "2026-11-25", "2026-11-25")).toBe(false);
  });

  it("lets only a region manager verify or send back a completed job", () => {
    expect(availableBookingActions("completed", { ...nobody, isRegionManager: true })).toEqual([
      "verify",
      "send_back",
    ]);
    expect(
      availableBookingActions("completed", {
        isRegionManager: false,
        isRequester: true,
        isFarmer: true,
      })
    ).toEqual([]);
    expect(availableBookingActions("verified", { ...nobody, isRegionManager: true })).toEqual([]);
  });

  it("accepts verify and send-back status changes", () => {
    for (const toStatus of ["verified", "in_progress"]) {
      expect(bookingStatusChangeSchema.safeParse({ bookingId: ID, toStatus }).success).toBe(true);
    }
  });

  it("parses actual acres from parallel form inputs", () => {
    const parsed = completeJobSchema.safeParse({
      bookingId: ID,
      fieldIds: [FIELD, FIELD_2],
      acres: ["1.5", "0"],
      notes: "  ",
    });
    expect(parsed.success && parsed.data).toEqual({
      bookingId: ID,
      fieldIds: [FIELD, FIELD_2],
      acres: [1.5, 0],
      notes: undefined,
    });
  });

  it("rejects mismatched, negative, or all-zero acres", () => {
    const base = { bookingId: ID, fieldIds: [FIELD, FIELD_2] };
    expect(completeJobSchema.safeParse({ ...base, acres: ["1"] }).success).toBe(false);
    expect(completeJobSchema.safeParse({ ...base, acres: ["-1", "2"] }).success).toBe(false);
    expect(completeJobSchema.safeParse({ ...base, acres: ["0", "0"] }).success).toBe(false);
    expect(completeJobSchema.safeParse({ ...base, acres: ["abc", "1"] }).success).toBe(false);
  });

  it("maps job rule hints", () => {
    const error = (hint: string) =>
      ({ code: "23514", hint, message: "", details: "" }) as PostgrestError;
    expect(toBookingError(error("not_job_day"))).toBe("not_job_day");
    expect(toBookingError(error("invalid_acres"))).toBe("invalid_acres");
  });
});

describe("groupPilotJobs (My jobs tabs)", () => {
  const TODAY = "2026-11-25";
  const job = (id: string, status: BookingStatus, date: string) => ({ id, status, date });

  it("splits jobs into today, upcoming, and completed", () => {
    const groups = groupPilotJobs(
      [
        job("today-assigned", "assigned", TODAY),
        job("sent-back", "in_progress", "2026-11-20"),
        job("later", "assigned", "2026-11-27"),
        job("done-old", "verified", "2026-11-10"),
        job("done-new", "completed", "2026-11-24"),
      ],
      TODAY
    );
    expect(groups.today.map((j) => j.id)).toEqual(["today-assigned", "sent-back"]);
    expect(groups.upcoming.map((j) => j.id)).toEqual(["later"]);
    expect(groups.completed.map((j) => j.id)).toEqual(["done-new", "done-old"]);
  });

  it("returns empty tabs when there are no jobs", () => {
    expect(groupPilotJobs([], TODAY)).toEqual({ today: [], upcoming: [], completed: [] });
  });
});

describe("formatSprayed (mission-plan area vs booked)", () => {
  const t = en.bookings;

  it("shows the difference when the mission plan differs from the booked acres", () => {
    expect(formatSprayed(4.3, 4, "en", t)).toBe("Sprayed 4.3 acres · booked 4 acres (+0.3)");
    expect(formatSprayed(3.5, 4, "en", t)).toBe("Sprayed 3.5 acres · booked 4 acres (-0.5)");
  });

  it("omits the difference when they match, and avoids float noise", () => {
    expect(formatSprayed(4, 4, "en", t)).toBe("Sprayed 4 acres · booked 4 acres");
    expect(formatSprayed(0.1 + 0.2, 0.3, "en", t)).toBe("Sprayed 0.3 acres · booked 0.3 acres");
  });

  it("formats the job total", () => {
    expect(formatSprayed(5.3, 5, "en", t, "totalSprayed")).toBe(
      "Total sprayed 5.3 acres · booked 5 acres (+0.3)"
    );
  });
});

describe("countByStatus", () => {
  it("counts every status, including ones with no bookings", () => {
    const counts = countByStatus([
      { status: "requested" },
      { status: "requested" },
      { status: "verified" },
    ]);
    expect(counts.requested).toBe(2);
    expect(counts.verified).toBe(1);
    expect(counts.confirmed).toBe(0);
    expect(Object.keys(counts)).toHaveLength(8);
  });
});
