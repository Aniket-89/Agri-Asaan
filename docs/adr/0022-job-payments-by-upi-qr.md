# 0022. Job payments by UPI QR, simulated for now

- Status: Accepted (owner request, 2026-11-27)
- Date: 2026-11-27

## Context

The owner wants the farmer to pay when the pilot finishes a job: the pilot
shows a UPI QR, the farmer scans and pays. Rates differ by region. A real
payment provider is not set up yet, so the first version is simulated.

AGENTS.md lists "detailed finance and cost tracking" and subscription
payments as out of MVP scope. A per-job amount with a paid/unpaid state is
much smaller than either; the owner asked for it explicitly.

## Decision

- **Rate per acre per region** (`regions.rate_per_acre`), set by organization
  admins on the Territory page; regional admins see it.
- **Charged on acres sprayed.** `complete_job` fixes `bookings.amount_due` =
  region rate × actual acres, and copies the rate onto the booking, so later
  rate changes never rewrite past jobs. No rate set: no amount due. A job
  already paid keeps its amount if it is sent back and completed again.
- **UPI QR.** The server builds a standard `upi://pay` link (payee UPI ID and
  name from `organization_settings`, amount, booking reference) and renders it
  as a QR image with the `qrcode` package (small, widely used, server-side
  only). The pilot sees it on the completed job; the farmer and region
  managers see it on the booking page.
- **Simulated.** Demo data uses an `@example` UPI ID, which every payment app
  rejects, so no real money can move. The panel says it is a demo payment.
- **Recording payment.** No provider confirms payment, so the assigned pilot
  (after the farmer pays in front of them) or a region manager (e.g. cash paid
  later) taps "Payment received": `record_job_payment` stores `paid_at` and
  `paid_recorded_by`. Farmers and mitras cannot mark jobs paid. A job can be
  paid once, only when completed or verified, and only with an amount.
- `get_booking_payment` returns the amount, payment state and UPI details to
  whoever can see the booking (pilots cannot read organization settings).

## Alternatives considered

- **Per acre booked / flat per job:** owner chose acres sprayed.
- **Farmer marks "I've paid":** unverified; rejected.
- **Payment gateway now (Razorpay, Cashfree, etc.):** needs a merchant
  account and webhooks; later, behind the same amount and paid fields.

## Consequences

- "Paid" means recorded by a person, not confirmed by a bank, until a
  provider is integrated.
- Real collection needs the organization's real UPI ID in
  `organization_settings` (no editing screen yet).
- No refunds, partial payments or receipts yet.
