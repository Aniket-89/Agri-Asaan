import type { PostgrestError } from "@supabase/supabase-js";

import type { Locale } from "@/lib/i18n";
import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { ActiveMembershipContext } from "@/modules/organizations";
import { availableBookingActions, type BookingAction, type BookingStatus } from "./booking.rules";
import * as repository from "./booking.repository";
import type { BookingStatusChangeInput, CreateBookingInput } from "./booking.schema";

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

  return {
    id: booking.id,
    status: booking.status,
    preferredDate: booking.preferred_date,
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
