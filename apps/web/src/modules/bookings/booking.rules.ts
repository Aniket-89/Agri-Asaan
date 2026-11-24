// Pure booking rules for the UI. They mirror set_booking_status and
// create_booking so screens only offer actions that will succeed; the
// database functions remain the enforcement layer.

export const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "rejected",
  "cancelled",
  "assigned",
  "in_progress",
  "completed",
  "verified",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Statuses that keep a field "taken" for new bookings.
export const OPEN_BOOKING_STATUSES: readonly BookingStatus[] = [
  "requested",
  "confirmed",
  "assigned",
  "in_progress",
];

export type BookingAction = "confirm" | "reject" | "cancel";

export type BookingActor = {
  // Organization admin, or regional admin assigned to the booking's region.
  isRegionManager: boolean;
  isRequester: boolean;
  // The farmer's own linked login.
  isFarmer: boolean;
};

export function availableBookingActions(
  status: BookingStatus,
  actor: BookingActor
): BookingAction[] {
  const actions: BookingAction[] = [];
  if (status === "requested" && actor.isRegionManager) {
    actions.push("confirm", "reject");
  }
  if (
    (status === "requested" && (actor.isRegionManager || actor.isRequester || actor.isFarmer)) ||
    (status === "confirmed" && actor.isRegionManager)
  ) {
    actions.push("cancel");
  }
  return actions;
}

export const BOOKING_WINDOW_DAYS = 60;
const BOOKING_TIME_ZONE = "Asia/Kolkata";

// Today in India and the last allowed preferred date, as YYYY-MM-DD strings
// (the same window create_booking enforces).
export function bookingDateWindow(now: Date): { min: string; max: string } {
  const min = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = min.split("-").map(Number);
  const max = new Date(Date.UTC(year, month - 1, day + BOOKING_WINDOW_DAYS))
    .toISOString()
    .slice(0, 10);
  return { min, max };
}
