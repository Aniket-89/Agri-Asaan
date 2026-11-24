import type { PostgrestError } from "@supabase/supabase-js";

import type { Locale } from "@/lib/i18n";
import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { ActiveMembershipContext } from "@/modules/organizations";
import {
  availableBookingActions,
  canAssignBooking,
  type BookingAction,
  type BookingStatus,
} from "./booking.rules";
import * as repository from "./booking.repository";
import type {
  AssignBookingInput,
  BookingStatusChangeInput,
  CreateBookingInput,
} from "./booking.schema";

// Rule violations reported by the booking database functions through HINT.
const BOOKING_RULE_ERRORS = [
  "farmer_inactive",
  "invalid_fields",
  "date_out_of_range",
  "field_already_booked",
  "invalid_notes",
  "invalid_transition",
  "reason_required",
  "invalid_reason",
  "invalid_slot",
  "slot_full",
  "slot_passed",
  "pilot_unavailable",
  "drone_unavailable",
  "pilot_busy",
  "drone_busy",
] as const;

export type BookingErrorCode = DomainErrorCode | (typeof BOOKING_RULE_ERRORS)[number];

// Every code a booking redirect may carry in ?error= / ?bookingError=.
export const BOOKING_ERROR_CODES = [
  "forbidden",
  "duplicate",
  "invalid",
  "not_found",
  ...BOOKING_RULE_ERRORS,
] as const satisfies readonly BookingErrorCode[];

export function toBookingError(error: PostgrestError): BookingErrorCode {
  const hint = (BOOKING_RULE_ERRORS as readonly string[]).find((code) => code === error.hint);
  if (error.code === "23514" && hint) {
    return hint as BookingErrorCode;
  }
  return toDomainError(error);
}

export type BookingListItem = {
  id: string;
  status: BookingStatus;
  preferredDate: string;
  totalAcres: number;
  farmerName: string;
  villageName: string;
};

export type BookingDetail = {
  id: string;
  status: BookingStatus;
  preferredDate: string;
  slotLabel: string | null;
  notes: string | null;
  totalAcres: number;
  createdAt: string;
  farmer: { id: string; fullName: string; phone: string };
  villageName: string;
  lines: {
    fieldId: string;
    fieldName: string;
    cropName: string;
    areaAcres: number;
    latitude: number;
    longitude: number;
  }[];
  history: {
    id: number;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus;
    reason: string | null;
    actorName: string;
    createdAt: string;
  }[];
  actions: BookingAction[];
  // Only filled for region managers, who also see the assign form.
  assignment: { pilotName: string; droneLabel: string } | null;
  canAssign: boolean;
};

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`Unable to load ${what}.`);
  }
  return result.data;
}

type ListRow = {
  id: string;
  status: BookingStatus;
  preferred_date: string;
  total_acres: number;
  farmer: { full_name: string } | null;
  village: { name: string } | null;
};

const toListItem = (row: ListRow): BookingListItem => ({
  id: row.id,
  status: row.status,
  preferredDate: row.preferred_date,
  totalAcres: row.total_acres,
  farmerName: row.farmer?.full_name ?? "",
  villageName: row.village?.name ?? "",
});

// Requested first (the inbox), then by preferred date.
const inboxOrder = (a: BookingListItem, b: BookingListItem) =>
  Number(b.status === "requested") - Number(a.status === "requested") ||
  a.preferredDate.localeCompare(b.preferredDate);

export function canUseBookingInbox(role: ActiveMembershipContext["role"]): boolean {
  return role === "organization_admin" || role === "regional_admin" || role === "mitra";
}

export async function listBookings(
  context: ActiveMembershipContext,
  status?: BookingStatus
): Promise<BookingListItem[] | null> {
  if (!canUseBookingInbox(context.role)) {
    return null;
  }
  const rows = unwrap(
    await repository.listBookings(context.supabase, context.organizationId, status),
    "bookings"
  );
  return rows.map(toListItem).sort(inboxOrder);
}

export async function listFarmerBookings(
  context: ActiveMembershipContext,
  farmerId: string
): Promise<BookingListItem[]> {
  const rows = unwrap(
    await repository.listFarmerBookings(context.supabase, context.organizationId, farmerId),
    "farmer bookings"
  );
  return rows.map(toListItem);
}

export async function listOpenBookedFieldIds(
  context: ActiveMembershipContext,
  farmerId: string
): Promise<Set<string>> {
  const rows = unwrap(
    await repository.listOpenBookedFieldIds(context.supabase, context.organizationId, farmerId),
    "booked fields"
  );
  return new Set(rows.map((row) => row.field_id));
}

export async function getOwnFarmerId(context: ActiveMembershipContext): Promise<string | null> {
  if (context.role !== "farmer") {
    return null;
  }
  const { data, error } = await repository.getOwnFarmerRecord(
    context.supabase,
    context.organizationId,
    context.userId
  );
  if (error) {
    throw new Error("Unable to load your farmer record.");
  }
  return data?.id ?? null;
}

export async function getBookingDetail(
  context: ActiveMembershipContext,
  bookingId: string,
  locale: Locale
): Promise<BookingDetail | null> {
  const { supabase, organizationId, userId, role } = context;
  const result = await repository.getBooking(supabase, organizationId, bookingId);
  if (result.error) {
    throw new Error("Unable to load booking.");
  }
  const booking = result.data;
  if (!booking || !booking.farmer) {
    return null;
  }

  const [lines, history, ownRegions] = await Promise.all([
    repository.listBookingLines(supabase, bookingId).then((r) => unwrap(r, "booking lines")),
    repository.listBookingHistory(supabase, bookingId).then((r) => unwrap(r, "booking history")),
    role === "regional_admin"
      ? repository
          .listOwnRegionIds(supabase, organizationId, userId)
          .then((r) => unwrap(r, "regions"))
      : Promise.resolve([]),
  ]);

  const actorIds = [
    ...new Set(history.map((row) => row.actor_id).filter((id): id is string => !!id)),
  ];
  const actors = actorIds.length
    ? unwrap(await repository.listProfileNames(supabase, actorIds), "names")
    : [];
  const actorName = new Map(actors.map((row) => [row.id, row.full_name ?? ""]));

  const isRegionManager =
    role === "organization_admin" ||
    (role === "regional_admin" && ownRegions.some((row) => row.region_id === booking.region_id));
  const assignment = isRegionManager ? await loadCurrentAssignment(context, bookingId) : null;

  return {
    id: booking.id,
    status: booking.status,
    preferredDate: booking.preferred_date,
    slotLabel: booking.slot ? formatSlotLabel(booking.slot, locale) : null,
    notes: booking.notes,
    totalAcres: booking.total_acres,
    createdAt: booking.created_at,
    farmer: {
      id: booking.farmer.id,
      fullName: booking.farmer.full_name,
      phone: booking.farmer.phone,
    },
    villageName: booking.village?.name ?? "",
    lines: lines.map((line) => ({
      fieldId: line.field_id,
      fieldName: line.field_name,
      cropName: locale === "hi" ? line.crop_name_hi : line.crop_name_en,
      areaAcres: line.area_acres,
      latitude: line.latitude,
      longitude: line.longitude,
    })),
    history: history.map((row) => ({
      id: row.id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      reason: row.reason,
      actorName: (row.actor_id && actorName.get(row.actor_id)) || "—",
      createdAt: row.created_at,
    })),
    actions: availableBookingActions(booking.status, {
      isRegionManager,
      isRequester: booking.requested_by === userId,
      isFarmer: role === "farmer" && booking.farmer.profile_id === userId,
    }),
    assignment,
    canAssign: canAssignBooking(booking.status, isRegionManager),
  };
}

async function loadCurrentAssignment(
  context: ActiveMembershipContext,
  bookingId: string
): Promise<BookingDetail["assignment"]> {
  const { data, error } = await repository.getCurrentAssignment(context.supabase, bookingId);
  if (error) {
    throw new Error("Unable to load assignment.");
  }
  if (!data) {
    return null;
  }
  const names = unwrap(
    await repository.listProfileNames(context.supabase, [data.pilot_user_id]),
    "pilot name"
  );
  return {
    pilotName: names[0]?.full_name || "—",
    droneLabel: data.drone ? `${data.drone.uid} · ${data.drone.model}` : "—",
  };
}

export type CreateBookingResult =
  { ok: true; bookingId: string } | { ok: false; error: BookingErrorCode };

export async function createBooking(
  context: ActiveMembershipContext,
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  const { error } = await repository.callCreateBooking(context.supabase, input);
  if (!error) {
    return { ok: true, bookingId: input.id };
  }
  const code = toBookingError(error);
  // Two concurrent submissions of the same form can race on the primary key;
  // if the booking now exists and is visible, the other attempt succeeded.
  if (code === "duplicate") {
    const existing = await repository.getBooking(
      context.supabase,
      context.organizationId,
      input.id
    );
    if (existing.data) {
      return { ok: true, bookingId: input.id };
    }
  }
  return { ok: false, error: code };
}

export async function changeBookingStatus(
  context: ActiveMembershipContext,
  input: BookingStatusChangeInput
): Promise<{ ok: true } | { ok: false; error: BookingErrorCode }> {
  const { error } = await repository.callSetBookingStatus(context.supabase, input);
  return error ? { ok: false, error: toBookingError(error) } : { ok: true };
}

export type SlotOption = {
  id: string;
  label: string;
  available: number;
};

// "Early morning · 06:00–09:00" in the viewer's language.
export function formatSlotLabel(
  slot: { name_en: string; name_hi: string; start_time: string; end_time: string },
  locale: Locale
): string {
  const name = locale === "hi" ? slot.name_hi : slot.name_en;
  return `${name} · ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}

// Slots for a date with the places left in the farmer's region. The database
// function checks that the caller may book for this farmer.
export async function getSlotAvailability(
  context: ActiveMembershipContext,
  farmerId: string,
  date: string,
  locale: Locale
): Promise<SlotOption[]> {
  const { data, error } = await repository.listSlotAvailability(context.supabase, farmerId, date);
  if (error) {
    throw new Error("Unable to load slot availability.");
  }
  return data.map((slot) => ({
    id: slot.slot_id,
    label: formatSlotLabel(slot, locale),
    available: slot.available,
  }));
}

export type AssignmentOption = {
  id: string;
  label: string;
  regionName: string | null;
  isHomeRegion: boolean;
  isCurrent: boolean;
};

export type AssignmentOptions = { pilots: AssignmentOption[]; drones: AssignmentOption[] };

// Pilots and drones free for the booking's date and slot, home region first.
// The database function checks that the caller manages the booking's region.
export async function getAssignmentOptions(
  context: ActiveMembershipContext,
  bookingId: string
): Promise<AssignmentOptions> {
  const rows = unwrap(
    await repository.listAssignmentOptions(context.supabase, bookingId),
    "assignment options"
  );
  const toOption = (row: (typeof rows)[number]): AssignmentOption => ({
    id: row.id,
    label: row.label,
    regionName: row.region_name,
    isHomeRegion: row.is_home_region,
    isCurrent: row.is_current,
  });
  return {
    pilots: rows.filter((row) => row.kind === "pilot").map(toOption),
    drones: rows.filter((row) => row.kind === "drone").map(toOption),
  };
}

export async function assignBooking(
  context: ActiveMembershipContext,
  input: AssignBookingInput
): Promise<{ ok: true } | { ok: false; error: BookingErrorCode }> {
  const { error } = await repository.callAssignBooking(context.supabase, input);
  return error ? { ok: false, error: toBookingError(error) } : { ok: true };
}

export type PilotJob = {
  bookingId: string;
  status: BookingStatus;
  date: string;
  slotLabel: string;
  farmerName: string;
  farmerPhone: string;
  villageName: string;
  totalAcres: number;
  droneUid: string;
  notes: string | null;
  fields: {
    fieldId: string;
    fieldName: string;
    cropName: string;
    areaAcres: number;
    latitude: number;
    longitude: number;
  }[];
};

type PilotJobFieldRow = {
  field_id: string;
  field_name: string;
  crop_name_en: string;
  crop_name_hi: string;
  area_acres: number;
  latitude: number;
  longitude: number;
};

// The signed-in pilot's upcoming jobs. Null for anyone who is not a pilot.
export async function listMyJobs(
  context: ActiveMembershipContext,
  locale: Locale
): Promise<PilotJob[] | null> {
  if (context.role !== "pilot") {
    return null;
  }
  const rows = unwrap(
    await repository.listMyJobs(context.supabase, context.organizationId),
    "jobs"
  );
  return rows.map((row) => ({
    bookingId: row.booking_id,
    status: row.status,
    date: row.preferred_date,
    slotLabel: formatSlotLabel(
      {
        name_en: row.slot_name_en,
        name_hi: row.slot_name_hi,
        start_time: row.start_time,
        end_time: row.end_time,
      },
      locale
    ),
    farmerName: row.farmer_name,
    farmerPhone: row.farmer_phone,
    villageName: row.village_name,
    totalAcres: row.total_acres,
    droneUid: row.drone_uid,
    notes: row.notes,
    // Built by list_my_jobs with jsonb_build_object, so the shape is fixed.
    fields: (row.fields as PilotJobFieldRow[]).map((field) => ({
      fieldId: field.field_id,
      fieldName: field.field_name,
      cropName: locale === "hi" ? field.crop_name_hi : field.crop_name_en,
      areaAcres: field.area_acres,
      latitude: field.latitude,
      longitude: field.longitude,
    })),
  }));
}
