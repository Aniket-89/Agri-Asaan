import { CheckCircleIcon, CurrencyInrIcon, QrCodeIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui";
import { format, type Dictionary, type Locale } from "@/lib/i18n";

import type { JobPayment } from "../payment.service";

const localeTag = (locale: Locale) => (locale === "hi" ? "hi-IN" : "en-IN");

export function formatRupees(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

// What the farmer owes for a completed job and how to pay it: a UPI QR while
// unpaid, then who recorded the payment. `record` adds the "Payment received"
// button for the pilot or a region manager (the database re-checks).
export function PaymentPanel({
  payment,
  acres,
  record,
  t,
  locale,
}: {
  payment: JobPayment;
  acres: number | null;
  record?: { action: (formData: FormData) => Promise<void>; bookingId: string; returnTo: string };
  t: Dictionary["payments"];
  locale: Locale;
}) {
  if (payment.amountDue === null) {
    return (
      <p className="flex gap-2 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">
        <CurrencyInrIcon weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t.noRate}
      </p>
    );
  }

  const amount = formatRupees(payment.amountDue, locale);
  const breakdown =
    payment.ratePerAcre !== null && acres !== null
      ? format(t.breakdown, {
          acres: new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2 }).format(
            acres
          ),
          rate: formatRupees(payment.ratePerAcre, locale),
        })
      : null;

  if (payment.paidAt) {
    const paidOn = new Intl.DateTimeFormat(localeTag(locale), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(payment.paidAt));
    return (
      <div className="flex items-start gap-3 rounded-xl bg-leaf-soft px-4 py-3 text-leaf-ink">
        <CheckCircleIcon weight="fill" className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div>
          <p className="text-lg font-bold">{format(t.paid, { amount })}</p>
          <p className="text-sm">{format(t.paidOn, { date: paidOn })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-canvas p-4">
      <div>
        <p className="text-sm font-semibold text-ink-muted">{t.amountDue}</p>
        <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">{amount}</p>
        {breakdown ? <p className="text-sm text-ink-muted">{breakdown}</p> : null}
      </div>

      {payment.qr ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
          {/* A data URL built on the server from our own UPI link; no remote image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.qr.dataUrl}
            alt={format(t.qrAlt, { amount, payee: payment.qr.payeeName })}
            width={224}
            height={224}
            className="size-56"
          />
          <p className="flex items-center gap-1.5 text-center text-sm font-semibold text-ink">
            <QrCodeIcon weight="bold" className="size-4" aria-hidden />
            {format(t.scanToPay, { payee: payment.qr.payeeName })}
          </p>
          <p className="text-xs text-ink-faint tabular-nums">{payment.reference}</p>
          {payment.qr.isDemo ? (
            <p className="rounded-lg bg-sun-soft px-3 py-2 text-center text-xs text-sun-ink">
              {t.demoNotice}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{t.noUpiId}</p>
      )}

      {record ? (
        <form action={record.action}>
          <input type="hidden" name="bookingId" value={record.bookingId} />
          <input type="hidden" name="returnTo" value={record.returnTo} />
          <Button block icon={<CheckCircleIcon weight="fill" className="size-5" aria-hidden />}>
            {t.markPaid}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">{t.unpaid}</p>
      )}
    </div>
  );
}
