import type { PinTone } from "@/lib/maps/geo";

// Booking statuses that colour a field on the region map.
export const OPEN_STATUSES = ["requested", "confirmed", "assigned", "in_progress"] as const;
export const DONE_STATUSES = ["completed", "verified"] as const;

// A field with any open booking is "open"; otherwise one sprayed recently is
// "done"; otherwise "neutral". The caller limits "recent" (last 30 days).
export function fieldTone(statuses: readonly string[]): PinTone {
  if (statuses.some((status) => (OPEN_STATUSES as readonly string[]).includes(status))) {
    return "open";
  }
  if (statuses.some((status) => (DONE_STATUSES as readonly string[]).includes(status))) {
    return "done";
  }
  return "neutral";
}
