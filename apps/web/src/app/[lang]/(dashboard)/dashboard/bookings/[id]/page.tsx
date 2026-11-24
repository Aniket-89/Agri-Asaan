import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { BOOKING_ERROR_CODES, canUseBookingInbox, getBookingDetail } from "@/modules/bookings";
import {
  BookingStatusBadge,
  formatAcres,
  formatBookingDate,
} from "@/modules/bookings/components/booking-ui";
import { getActiveMembershipContext } from "@/modules/organizations";

import { changeBookingStatusAction } from "../actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["booked", "updated"]).optional().catch(undefined),
  error: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.bookings.detailTitle };
}

async function BookingDetailContent({
  params,
  searchParams,
  t,
  locale,
}: {
  params: PageProps<"/[lang]/dashboard/bookings/[id]">["params"];
  searchParams: PageProps<"/[lang]/dashboard/bookings/[id]">["searchParams"];
  t: Dictionary["bookings"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const bookingId = z.uuid().safeParse((await params).id);
  if (!bookingId.success) {
    notFound();
  }
  const [booking, search] = await Promise.all([
    getBookingDetail(context, bookingId.data, locale),
    searchParams.then((value) => searchSchema.parse(value)),
  ]);
  if (!booking) {
    notFound();
  }

  const backHref = withLocale(
    locale,
    canUseBookingInbox(context.role) ? "/dashboard/bookings" : "/dashboard/my-farm"
  );
  const timeFormat = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  return (
    <>
      <a className="inline-block min-h-11 py-2 text-sm underline" href={backHref}>
        ← {t.backToBookings}
      </a>

      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      {search.status === "booked" ? <StatusBanner kind="success" text={t.booked} /> : null}
      {search.status === "updated" ? <StatusBanner kind="success" text={t.updated} /> : null}

      <section className="space-y-2 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{t.detailTitle}</h1>
          <BookingStatusBadge status={booking.status} t={t} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-600">{t.farmer}</dt>
          <dd>
            {booking.farmer.fullName} ·{" "}
            <a className="underline" href={`tel:+91${booking.farmer.phone}`}>
              {booking.farmer.phone}
            </a>
          </dd>
          <dt className="text-gray-600">{t.village}</dt>
          <dd>{booking.villageName}</dd>
          <dt className="text-gray-600">{t.preferredDate}</dt>
          <dd>{formatBookingDate(booking.preferredDate, locale)}</dd>
        </dl>
        {booking.notes ? <p className="rounded bg-gray-50 p-3 text-sm">{booking.notes}</p> : null}
      </section>

      <section className="space-y-2" aria-labelledby="lines-heading">
        <h2 id="lines-heading" className="text-lg font-semibold">
          {t.fields} · {formatAcres(booking.totalAcres, locale, t)}
        </h2>
        <ul className="space-y-2">
          {booking.lines.map((line) => (
            <li key={line.fieldId} className="rounded border p-3 text-sm">
              <p className="font-medium">{line.fieldName}</p>
              <p>
                {line.cropName} · {formatAcres(line.areaAcres, locale, t)}
              </p>
              <p className="text-gray-600">
                {line.latitude}, {line.longitude}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {booking.actions.length > 0 ? (
        <section className="space-y-3 rounded-xl border p-4" aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="text-lg font-semibold">
            {t.actions}
          </h2>
          {booking.actions.includes("confirm") ? (
            <form action={changeBookingStatusAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="toStatus" value="confirmed" />
              <button
                type="submit"
                className="min-h-11 w-full rounded bg-black px-4 py-3 text-white"
              >
                {t.confirm}
              </button>
            </form>
          ) : null}
          {booking.actions.includes("reject") ? (
            <form action={changeBookingStatusAction} className="space-y-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="toStatus" value="rejected" />
              <label className="block">
                <span className="mb-1 block text-sm">{t.rejectReason}</span>
                <input
                  name="reason"
                  required
                  maxLength={500}
                  className="min-h-11 w-full rounded border px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="min-h-11 w-full rounded border border-red-700 px-4 py-2 text-red-800"
              >
                {t.reject}
              </button>
            </form>
          ) : null}
          {booking.actions.includes("cancel") ? (
            <form action={changeBookingStatusAction} className="space-y-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="toStatus" value="cancelled" />
              <label className="block">
                <span className="mb-1 block text-sm">{t.cancelReason}</span>
                <input
                  name="reason"
                  maxLength={500}
                  className="min-h-11 w-full rounded border px-3 py-2"
                />
              </label>
              <button type="submit" className="min-h-11 w-full rounded border px-4 py-2">
                {t.cancel}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          {t.history}
        </h2>
        <ol className="space-y-2 border-l-2 pl-4">
          {booking.history.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="font-medium">
                {format(t.historyEntry, {
                  status: t.statuses[entry.toStatus],
                  actor: entry.actorName,
                })}
              </p>
              <p className="text-gray-600">{timeFormat.format(new Date(entry.createdAt))}</p>
              {entry.reason ? <p className="italic">“{entry.reason}”</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/bookings/[id]">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <BookingDetailContent
          params={params}
          searchParams={searchParams}
          t={t.bookings}
          locale={locale}
        />
      </Suspense>
    </main>
  );
}
