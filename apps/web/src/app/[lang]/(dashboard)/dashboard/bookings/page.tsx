import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { bookingListFilterSchema, listBookings, type BookingStatus } from "@/modules/bookings";
import { BookingList } from "@/modules/bookings/components/booking-ui";
import { getActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

const FILTERS: (BookingStatus | undefined)[] = [
  undefined,
  "requested",
  "confirmed",
  "cancelled",
  "rejected",
];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.bookings.title };
}

async function BookingInbox({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/bookings">["searchParams"];
  t: Dictionary["bookings"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const { status } = bookingListFilterSchema.parse(await searchParams);
  const bookings = await listBookings(context, status);
  if (!bookings) {
    notFound();
  }

  return (
    <>
      <nav aria-label={t.filterLabel} className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <a
            key={filter ?? "all"}
            href={withLocale(
              locale,
              filter ? `/dashboard/bookings?status=${filter}` : "/dashboard/bookings"
            )}
            aria-current={filter === status ? "page" : undefined}
            className={`min-h-11 rounded px-3 py-2 text-sm ${
              filter === status ? "bg-black text-white" : "border"
            }`}
          >
            {filter ? t.statuses[filter] : t.filterAll}
          </a>
        ))}
      </nav>
      {bookings.length === 0 ? <p>{status ? t.noneForFilter : t.none}</p> : null}
      {bookings.length > 0 ? <BookingList bookings={bookings} locale={locale} t={t} /> : null}
    </>
  );
}

export default async function BookingsPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/bookings">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.bookings.backToDashboard}
        </a>
        <h1 className="text-2xl font-semibold">{t.bookings.title}</h1>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <BookingInbox searchParams={searchParams} t={t.bookings} locale={locale} />
      </Suspense>
    </main>
  );
}
