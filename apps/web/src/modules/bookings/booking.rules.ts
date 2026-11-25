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

export type BookingAction = "confirm" | "reject" | "cancel" | "verify" | "send_back";

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
    ((status === "confirmed" || status === "assigned") && actor.isRegionManager)
  ) {
    actions.push("cancel");
  }
  if (status === "completed" && actor.isRegionManager) {
    actions.push("verify", "send_back");
  }
  return actions;
}

// Mirrors assign_booking: region managers assign confirmed bookings and can
// reassign while assigned.
export function canAssignBooking(status: BookingStatus, isRegionManager: boolean): boolean {
  return isRegionManager && (status === "confirmed" || status === "assigned");
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

// Mirrors start_job: the assigned pilot starts an assigned job on its day
// (`today` is the organization's local date, YYYY-MM-DD).
export function canStartJob(status: BookingStatus, jobDate: string, today: string): boolean {
  return status === "assigned" && jobDate === today;
}

export const PILOT_JOB_TABS = ["today", "upcoming", "completed"] as const;
export type PilotJobTab = (typeof PILOT_JOB_TABS)[number];

// Splits a pilot's jobs into tabs. Today also holds every started job that
// is not finished yet (e.g. one sent back for correction), whatever its date.
// Completed (and verified) jobs are newest first; the others keep the given
// date/slot order.
export function groupPilotJobs<T extends { status: BookingStatus; date: string }>(
  jobs: readonly T[],
  today: string
): Record<PilotJobTab, T[]> {
  const groups: Record<PilotJobTab, T[]> = { today: [], upcoming: [], completed: [] };
  for (const job of jobs) {
    if (job.status === "completed" || job.status === "verified") {
      groups.completed.push(job);
    } else if (job.status === "in_progress" || job.date <= today) {
      groups.today.push(job);
    } else {
      groups.upcoming.push(job);
    }
  }
  groups.completed.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}
