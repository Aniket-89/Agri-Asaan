import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  BOOKING_ERROR_CODES,
  bookingDateWindow,
  getOwnFarmerId,
  listFarmerBookings,
  listOpenBookedFieldIds,
} from "@/modules/bookings";
import { BookingForm, BookingList, formatAcres } from "@/modules/bookings/components/booking-ui";
import { listFarmerFields } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

import { createBookingAction } from "../bookings/actions";

export const instant = false;

const searchSchema = z.object({
  bookingError: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.bookings.myFarmTitle };
}

async function MyFarmContent({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/my-farm">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  if (context.role !== "farmer") {
    notFound();
  }

  const farmerId = await getOwnFarmerId(context);
  if (!farmerId) {
    return <p>{t.bookings.noFarmerRecord}</p>;
  }

  // The farmer reads their own fields through the fields module; RLS limits
  // them to their linked record.
  const [fields, bookings, bookedFieldIds, search] = await Promise.all([
    listFarmerFields(context, farmerId, locale),
    listFarmerBookings(context, farmerId),
    listOpenBookedFieldIds(context, farmerId),
    searchParams.then((value) => searchSchema.parse(value)),
  ]);

  return (
    <>
      {search.bookingError ? (
        <StatusBanner kind="error" text={t.bookings.errors[search.bookingError]} />
      ) : null}

      <section className="space-y-2" aria-labelledby="my-fields-heading">
        <h2 id="my-fields-heading" className="text-xl font-semibold">
          {t.fields.heading}
        </h2>
        {fields.length === 0 ? <p className="text-gray-600">{t.fields.none}</p> : null}
        <ul className="space-y-2">
          {fields.map((field) => (
            <li key={field.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{field.name}</p>
              <p>
                {field.cropName} · {formatAcres(field.areaAcres, locale, t.bookings)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <BookingForm
        farmerId={farmerId}
        fields={fields
          .filter((field) => field.isActive)
          .map((field) => ({
            id: field.id,
            name: field.name,
            cropName: field.cropName,
            areaAcres: field.areaAcres,
            alreadyBooked: bookedFieldIds.has(field.id),
          }))}
        dateWindow={bookingDateWindow(new Date())}
        returnTo="my-farm"
        action={createBookingAction}
        locale={locale}
        t={t.bookings}
      />

      {bookings.length > 0 ? (
        <section className="space-y-2" aria-labelledby="my-bookings-heading">
          <h2 id="my-bookings-heading" className="text-xl font-semibold">
            {t.bookings.farmerBookings}
          </h2>
          <BookingList bookings={bookings} locale={locale} t={t.bookings} showFarmer={false} />
        </section>
      ) : null}
    </>
  );
}

export default async function MyFarmPage({ searchParams }: PageProps<"/[lang]/dashboard/my-farm">) {
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
        <h1 className="text-2xl font-semibold">{t.bookings.myFarmTitle}</h1>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <MyFarmContent searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </main>
  );
}
