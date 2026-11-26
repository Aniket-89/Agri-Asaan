import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ActiveMembershipContext } from "@/modules/organizations";
import { getJobPayment, recordJobPayment } from "./payment.service";
import { bookingReference, buildUpiPayLink, isDemoUpiId } from "./upi";

const BOOKING_ID = "1a2b3c4d-0000-4000-8000-000000000001";

describe("buildUpiPayLink", () => {
  it("builds a UPI pay link with a two-decimal amount in rupees", () => {
    expect(
      buildUpiPayLink({
        upiId: "agriasaan.demo@example",
        payeeName: "AgriAsaan (demo)",
        amount: 1125,
        note: "Spraying AG-1A2B3C4D",
        reference: "AG-1A2B3C4D",
      })
    ).toBe(
      "upi://pay?pa=agriasaan.demo%40example&pn=AgriAsaan%20(demo)&am=1125.00&cu=INR&tn=Spraying%20AG-1A2B3C4D&tr=AG-1A2B3C4D"
    );
  });

  it("encodes characters that would break the link", () => {
    const link = buildUpiPayLink({
      upiId: "a@example",
      payeeName: "R&D Agri",
      amount: 10.5,
      note: "x=y",
      reference: "r",
    });
    expect(link).toContain("pn=R%26D%20Agri");
    expect(link).toContain("tn=x%3Dy");
    expect(link).toContain("am=10.50");
  });
});

describe("booking references and demo IDs", () => {
  it("makes a short uppercase reference from the booking id", () => {
    expect(bookingReference(BOOKING_ID)).toBe("AG-00000001");
  });

  it("treats @example UPI IDs as demo", () => {
    expect(isDemoUpiId("agriasaan.demo@example")).toBe(true);
    expect(isDemoUpiId("agriasaan@okhdfc")).toBe(false);
  });
});

function supabaseReturning(data: unknown, error: unknown = null) {
  return { rpc: vi.fn(async () => ({ data, error })) };
}

describe("getJobPayment", () => {
  const row = {
    amount_due: 1125,
    rate_per_acre: 450,
    paid_at: null,
    upi_id: "agriasaan.demo@example",
    payee_name: "AgriAsaan (demo)",
  };

  it("returns the amount and a QR for an unpaid job", async () => {
    const payment = await getJobPayment(supabaseReturning([row]) as never, BOOKING_ID);
    expect(payment?.amountDue).toBe(1125);
    expect(payment?.qr?.link).toContain("am=1125.00");
    expect(payment?.qr?.dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(payment?.qr?.isDemo).toBe(true);
  });

  it("shows no QR once paid, or without an amount or UPI ID", async () => {
    const paid = await getJobPayment(
      supabaseReturning([{ ...row, paid_at: "2026-11-27T10:00:00Z" }]) as never,
      BOOKING_ID
    );
    expect(paid?.qr).toBeNull();
    const noRate = await getJobPayment(
      supabaseReturning([{ ...row, amount_due: null }]) as never,
      BOOKING_ID
    );
    expect(noRate?.qr).toBeNull();
    const noUpi = await getJobPayment(
      supabaseReturning([{ ...row, upi_id: null }]) as never,
      BOOKING_ID
    );
    expect(noUpi?.qr).toBeNull();
  });

  it("returns null when the caller cannot see the booking", async () => {
    expect(await getJobPayment(supabaseReturning([]) as never, BOOKING_ID)).toBeNull();
  });
});

describe("recordJobPayment", () => {
  const context = (role: ActiveMembershipContext["role"], error: unknown = null) =>
    ({ role, supabase: supabaseReturning(null, error) }) as unknown as ActiveMembershipContext;

  it("refuses farmers and mitras before calling the database", async () => {
    const farmer = context("farmer");
    await expect(recordJobPayment(farmer, BOOKING_ID)).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(farmer.supabase.rpc).not.toHaveBeenCalled();
  });

  it("records a payment for the pilot", async () => {
    await expect(recordJobPayment(context("pilot"), BOOKING_ID)).resolves.toEqual({ ok: true });
  });

  it("maps database refusals to booking errors", async () => {
    await expect(
      recordJobPayment(
        context("pilot", { code: "23514", hint: "already_paid", message: "" }),
        BOOKING_ID
      )
    ).resolves.toEqual({ ok: false, error: "already_paid" });
  });
});
