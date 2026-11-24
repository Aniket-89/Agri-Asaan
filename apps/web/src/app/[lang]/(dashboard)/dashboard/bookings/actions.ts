"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import {
  assignBooking,
  assignBookingSchema,
  bookingStatusChangeSchema,
  changeBookingStatus,
  createBooking,
  createBookingSchema,
} from "@/modules/bookings";
import { getActiveMembershipContext } from "@/modules/organizations";

const returnToSchema = z.enum(["farmer", "my-farm"]);

export async function createBookingAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  // Where to send the user back on error: only validated, known destinations.
  const returnTo = returnToSchema.safeParse(formData.get("returnTo"));
  const farmerId = z.uuid().safeParse(formData.get("farmerId"));
  const backPath =
    returnTo.success && returnTo.data === "my-farm"
      ? "/dashboard/my-farm"
      : farmerId.success
        ? `/dashboard/farmers/${farmerId.data}`
        : "/dashboard";

  const parsed = createBookingSchema.safeParse({
    id: formData.get("id"),
    farmerId: formData.get("farmerId"),
    fieldIds: formData.getAll("fieldIds"),
    preferredDate: formData.get("preferredDate"),
    slotId: formData.get("slotId"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    // Most likely cause: no field ticked.
    redirect(await localizedPath(`${backPath}?bookingError=invalid_fields`));
  }

  const result = await createBooking(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok
        ? `/dashboard/bookings/${result.bookingId}?status=booked`
        : `${backPath}?bookingError=${result.error}`
    )
  );
}

export async function changeBookingStatusAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const parsed = bookingStatusChangeSchema.safeParse({
    bookingId: formData.get("bookingId"),
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") ?? undefined,
  });
  const bookingId = z.uuid().safeParse(formData.get("bookingId"));
  const detailPath = bookingId.success
    ? `/dashboard/bookings/${bookingId.data}`
    : "/dashboard/bookings";
  if (!parsed.success) {
    redirect(await localizedPath(`${detailPath}?error=invalid`));
  }

  const result = await changeBookingStatus(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${detailPath}?status=updated` : `${detailPath}?error=${result.error}`
    )
  );
}

export async function assignBookingAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const bookingId = z.uuid().safeParse(formData.get("bookingId"));
  const detailPath = bookingId.success
    ? `/dashboard/bookings/${bookingId.data}`
    : "/dashboard/bookings";
  const parsed = assignBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    pilotUserId: formData.get("pilotUserId"),
    droneId: formData.get("droneId"),
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${detailPath}?error=invalid`));
  }

  const result = await assignBooking(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${detailPath}?status=assigned` : `${detailPath}?error=${result.error}`
    )
  );
}
