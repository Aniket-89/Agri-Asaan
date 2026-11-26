import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { OPEN_BOOKING_STATUSES, type BookingStatus } from "./booking.rules";
import type {
  AssignBookingInput,
  BookingStatusChangeInput,
  CompleteJobInput,
  CreateBookingInput,
  StartJobInput,
} from "./booking.schema";

type Client = SupabaseClient<Database>;

const BOOKING_LIST_LIMIT = 100;

// Reads run with the caller's session (RLS scopes them); writes go through
// the create_booking / set_booking_status database functions only.

export async function callCreateBooking(supabase: Client, input: CreateBookingInput) {
  return supabase.rpc("create_booking", {
    p_booking_id: input.id,
    p_farmer_id: input.farmerId,
    p_field_ids: input.fieldIds,
    p_preferred_date: input.preferredDate,
    p_slot_id: input.slotId,
    p_notes: input.notes,
  });
}

export async function callSetBookingStatus(supabase: Client, input: BookingStatusChangeInput) {
  return supabase.rpc("set_booking_status", {
    p_booking_id: input.bookingId,
    p_to_status: input.toStatus,
    p_reason: input.reason,
  });
}

const LIST_COLUMNS =
  "id, status, preferred_date, total_acres, created_at, farmer:farmers!bookings_farmer_same_tenant(full_name, locality, pincode), village:villages!bookings_village_same_tenant(name)";

export async function listBookings(supabase: Client, tenantId: string, status?: BookingStatus) {
  let request = supabase
    .from("bookings")
    .select(LIST_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("preferred_date")
    .order("created_at")
    .limit(BOOKING_LIST_LIMIT);
  if (status) {
    request = request.eq("status", status);
  }
  return request;
}

export async function listFarmerBookings(supabase: Client, tenantId: string, farmerId: string) {
  return supabase
    .from("bookings")
    .select(LIST_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: false })
    .limit(BOOKING_LIST_LIMIT);
}

export async function listOpenBookedFieldIds(supabase: Client, tenantId: string, farmerId: string) {
  return supabase
    .from("booking_fields")
    .select("field_id, booking:bookings!booking_fields_booking_same_farmer!inner(status)")
    .eq("tenant_id", tenantId)
    .eq("farmer_id", farmerId)
    .in("booking.status", [...OPEN_BOOKING_STATUSES]);
}

export async function getBooking(supabase: Client, tenantId: string, bookingId: string) {
  return supabase
    .from("bookings")
    .select(
      "id, status, preferred_date, notes, total_acres, region_id, requested_by, created_at, started_at, completed_at, actual_total_acres, completion_notes, verified_at, farmer:farmers!bookings_farmer_same_tenant(id, full_name, phone, profile_id, locality, pincode), village:villages!bookings_village_same_tenant(name), slot:spray_slots!bookings_slot_same_tenant(name_en, name_hi, start_time, end_time)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
}

export async function listBookingLines(supabase: Client, bookingId: string) {
  return supabase
    .from("booking_fields")
    .select(
      "field_id, field_name, crop_name_en, crop_name_hi, area_acres, actual_acres, latitude, longitude"
    )
    .eq("booking_id", bookingId)
    .order("field_name");
}

export async function listBookingHistory(supabase: Client, bookingId: string) {
  return supabase
    .from("booking_status_history")
    .select("id, from_status, to_status, reason, actor_id, created_at")
    .eq("booking_id", bookingId)
    .order("id");
}

export async function listProfileNames(supabase: Client, ids: string[]) {
  return supabase.from("profiles").select("id, full_name").in("id", ids);
}

export async function listOwnRegionIds(supabase: Client, tenantId: string, userId: string) {
  return supabase
    .from("regional_admin_regions")
    .select("region_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
}

export async function getOwnFarmerRecord(supabase: Client, tenantId: string, userId: string) {
  return supabase
    .from("farmers")
    .select("id, village_id, region_id")
    .eq("tenant_id", tenantId)
    .eq("profile_id", userId)
    .maybeSingle();
}

export async function listSlotAvailability(supabase: Client, farmerId: string, date: string) {
  return supabase.rpc("list_slot_availability", { p_farmer_id: farmerId, p_date: date });
}

export async function callAssignBooking(supabase: Client, input: AssignBookingInput) {
  return supabase.rpc("assign_booking", {
    p_booking_id: input.bookingId,
    p_pilot_user_id: input.pilotUserId,
    p_drone_id: input.droneId,
  });
}

export async function listAssignmentOptions(supabase: Client, bookingId: string) {
  return supabase.rpc("list_assignment_options", { p_booking_id: bookingId });
}

export async function getCurrentAssignment(supabase: Client, bookingId: string) {
  return supabase
    .from("booking_assignments")
    .select("pilot_user_id, drone:drones!booking_assignments_drone_same_tenant(uid, model)")
    .eq("booking_id", bookingId)
    .eq("is_current", true)
    .maybeSingle();
}

export async function listMyJobs(supabase: Client, tenantId: string) {
  return supabase.rpc("list_my_jobs", { p_tenant_id: tenantId });
}

export async function callStartJob(supabase: Client, input: StartJobInput) {
  return supabase.rpc("start_job", { p_booking_id: input.bookingId });
}

export async function callCompleteJob(supabase: Client, input: CompleteJobInput) {
  return supabase.rpc("complete_job", {
    p_booking_id: input.bookingId,
    p_field_ids: input.fieldIds,
    p_acres: input.acres,
    p_notes: input.notes,
  });
}
