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
  toStatus: z.enum(["confirmed", "rejected", "cancelled"]),
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

export const bookingListFilterSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional().catch(undefined),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AssignBookingInput = z.infer<typeof assignBookingSchema>;
export type BookingStatusChangeInput = z.infer<typeof bookingStatusChangeSchema>;
