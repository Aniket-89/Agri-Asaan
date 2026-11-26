import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import { toBookingError, type BookingErrorCode } from "@/modules/bookings";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { Database } from "@/types/database.types";
import { bookingReference, buildUpiPayLink, isDemoUpiId } from "./upi";

// Job payments by UPI QR, simulated for now (ADR 0022). The amount is fixed by
// the database when the pilot completes the job; "paid" is recorded by the
// pilot or a region manager, since no payment provider confirms it yet.

export type JobPayment = {
  amountDue: number | null;
  ratePerAcre: number | null;
  paidAt: string | null;
  reference: string;
  // Present while the job is unpaid and both an amount and a UPI ID exist.
  qr: { dataUrl: string; link: string; payeeName: string; isDemo: boolean } | null;
};

export type RecordPaymentResult = { ok: true } | { ok: false; error: BookingErrorCode };

// Null when the caller cannot see the booking.
export async function getJobPayment(
  supabase: SupabaseClient<Database>,
  bookingId: string
): Promise<JobPayment | null> {
  const { data, error } = await supabase.rpc("get_booking_payment", { p_booking_id: bookingId });
  if (error) {
    throw new Error("Unable to load the payment.");
  }
  const row = data?.[0];
  if (!row) {
    return null;
  }

  const reference = bookingReference(bookingId);
  let qr: JobPayment["qr"] = null;
  if (row.amount_due !== null && row.paid_at === null && row.upi_id) {
    const link = buildUpiPayLink({
      upiId: row.upi_id,
      payeeName: row.payee_name,
      amount: row.amount_due,
      note: `Spraying ${reference}`,
      reference,
    });
    const svg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    qr = {
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      link,
      payeeName: row.payee_name,
      isDemo: isDemoUpiId(row.upi_id),
    };
  }

  return {
    amountDue: row.amount_due,
    ratePerAcre: row.rate_per_acre,
    paidAt: row.paid_at,
    reference,
    qr,
  };
}

// The assigned pilot or a region manager records that the farmer paid; the
// database checks who may and refuses unpaid-able or already-paid jobs.
export async function recordJobPayment(
  context: ActiveMembershipContext,
  bookingId: string
): Promise<RecordPaymentResult> {
  if (!["pilot", "regional_admin", "organization_admin"].includes(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await context.supabase.rpc("record_job_payment", { p_booking_id: bookingId });
  return error ? { ok: false, error: toBookingError(error) } : { ok: true };
}
