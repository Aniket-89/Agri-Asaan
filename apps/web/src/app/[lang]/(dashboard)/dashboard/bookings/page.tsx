import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { TrayIcon } from "@phosphor-icons/react/dist/ssr";

import { EmptyState, FilterChips, Page, PageHeader, PageSkeleton } from "@/components/ui";
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
  "assigned",
  "in_progress",
  "completed",
  "verified",
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
      <FilterChips
        label={t.filterLabel}
        items={FILTERS.map((filter) => ({
          key: filter ?? "all",
          href: withLocale(
            locale,
            filter ? `/dashboard/bookings?status=${filter}` : "/dashboard/bookings"
          ),
          label: filter ? t.statuses[filter] : t.filterAll,
          active: filter === status,
        }))}
      />
      {bookings.length === 0 ? (
        <EmptyState
          icon={<TrayIcon weight="duotone" className="size-7" />}
          text={status ? t.noneForFilter : t.none}
        />
      ) : (
        <BookingList bookings={bookings} locale={locale} t={t} />
      )}
    </>
  );
}

export default async function BookingsPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/bookings">) {
  const { locale, t } = await getDictionary();

  return (
    <Page>
      <PageHeader title={t.bookings.title} />
      <Suspense fallback={<PageSkeleton />}>
        <BookingInbox searchParams={searchParams} t={t.bookings} locale={locale} />
      </Suspense>
    </Page>
  );
}
