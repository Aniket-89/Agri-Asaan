import { z } from "zod";

import { BOOKING_STATUSES } from "./booking.rules";

export const createBookingSchema = z.object({
  // Generated when the form is rendered, so a retried submission is idempotent.
  id: z.uuid(),
  farmerId: z.uuid(),
  fieldIds: z.array(z.uuid()).min(1).max(20),
  preferredDate: z.iso.date(),
  // The slot reserved for that date (see list_slot_availability).
  slotId: z.uuid(),
  notes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500).optional()
  ),
});

export const bookingStatusChangeSchema = z.object({
  bookingId: z.uuid(),
  // "in_progress" here is a region manager sending a completed job back.
  toStatus: z.enum(["confirmed", "rejected", "cancelled", "verified", "in_progress"]),
  reason: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500).optional()
  ),
});

export const assignBookingSchema = z.object({
  bookingId: z.uuid(),
  pilotUserId: z.uuid(),
  droneId: z.uuid(),
});

export const startJobSchema = z.object({ bookingId: z.uuid() });

const optionalNotes = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional()
);

// One entry per booked field, in the same order (parallel form inputs).
export const completeJobSchema = z
  .object({
    bookingId: z.uuid(),
    fieldIds: z.array(z.uuid()).min(1).max(20),
    acres: z.array(z.coerce.number().min(0).max(100000)).min(1).max(20),
    notes: optionalNotes,
  })
  .refine((input) => input.fieldIds.length === input.acres.length, { path: ["acres"] })
  .refine((input) => input.acres.some((value) => value > 0), { path: ["acres"] });

export const bookingListFilterSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional().catch(undefined),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type StartJobInput = z.infer<typeof startJobSchema>;
export type CompleteJobInput = z.infer<typeof completeJobSchema>;
export type AssignBookingInput = z.infer<typeof assignBookingSchema>;
export type BookingStatusChangeInput = z.infer<typeof bookingStatusChangeSchema>;
