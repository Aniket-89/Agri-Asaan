import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { ClipboardTextIcon, PlantIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { StatusBanner } from "@/components/shared/status-banner";
import { EmptyState, Page, PageHeader, Panel } from "@/components/ui";
import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  BOOKING_ERROR_CODES,
  bookingDateWindow,
  getOwnFarmer,
  getSlotAvailability,
  listFarmerBookings,
  listOpenBookedFieldIds,
} from "@/modules/bookings";
import { BookingForm, BookingList, formatAcres } from "@/modules/bookings/components/booking-ui";
import { listCropOptions, listFarmerFields } from "@/modules/fields";
import { AddFieldForm } from "@/modules/fields/components/add-field-form";
import { getActiveMembershipContext } from "@/modules/organizations";

import { createBookingAction } from "../bookings/actions";
import { addOwnFieldAction } from "./actions";

export const instant = false;

const searchSchema = z.object({
  bookingError: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
  status: z.enum(["fieldSaved"]).optional().catch(undefined),
  fieldError: z
    .enum(["forbidden", "duplicate", "invalid", "not_found"])
    .optional()
    .catch(undefined),
  slotDate: z.iso.date().optional().catch(undefined),
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

  const ownFarmer = await getOwnFarmer(context);
  if (!ownFarmer) {
    return (
      <EmptyState
        icon={<UserCircleIcon weight="duotone" className="size-7" />}
        text={t.bookings.noFarmerRecord}
      />
    );
  }

  const farmerId = ownFarmer.id;

  // The farmer reads their own fields through the fields module; RLS limits
  // them to their linked record.
  const [fields, crops, bookings, bookedFieldIds, search] = await Promise.all([
    listFarmerFields(context, farmerId, locale),
    listCropOptions(context, locale),
    listFarmerBookings(context, farmerId),
    listOpenBookedFieldIds(context, farmerId),
    searchParams.then((value) => searchSchema.parse(value)),
  ]);
  const dateWindow = bookingDateWindow(new Date());
  const selectedDate =
    search.slotDate && search.slotDate >= dateWindow.min && search.slotDate <= dateWindow.max
      ? search.slotDate
      : dateWindow.min;
  const slots = await getSlotAvailability(context, farmerId, selectedDate, locale);

  return (
    <>
      {search.bookingError ? (
        <StatusBanner kind="error" text={t.bookings.errors[search.bookingError]} />
      ) : null}
      {search.fieldError ? (
        <StatusBanner kind="error" text={t.farmers.errors[search.fieldError]} />
      ) : null}
      {search.status === "fieldSaved" ? (
        <StatusBanner kind="success" text={t.fields.saved} />
      ) : null}
      {ownFarmer.inServiceArea ? null : (
        <p className="rounded-2xl bg-sun-soft px-4 py-3 text-ink">
          {t.bookings.outsideServiceArea}
        </p>
      )}

      <Panel
        id="my-fields"
        title={t.fields.heading}
        icon={<PlantIcon weight="duotone" className="size-5" />}
      >
        <div className="space-y-3">
          {fields.length === 0 ? <p className="text-ink-muted">{t.fields.none}</p> : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <li key={field.id} className="flex items-center gap-3 rounded-xl bg-canvas px-4 py-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-ink"
                >
                  <PlantIcon weight="fill" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{field.name}</span>
                  <span className="block text-sm text-ink-muted">
                    {field.cropName}, {formatAcres(field.areaAcres, locale, t.bookings)}
                  </span>
                  <a
                    href={withLocale(
                      locale,
                      field.boundary
                        ? `/dashboard/fields/${field.id}`
                        : `/dashboard/fields/${field.id}/boundary`
                    )}
                    className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
                  >
                    {field.boundary ? t.cropHealth.view : t.cropHealth.addBoundary}
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <AddFieldForm
            action={addOwnFieldAction}
            farmerId={farmerId}
            crops={crops}
            center={null}
            open={fields.length === 0}
            t={t}
          />
        </div>
      </Panel>

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
        dateWindow={dateWindow}
        selectedDate={selectedDate}
        slots={slots}
        returnTo="my-farm"
        action={createBookingAction}
        locale={locale}
        t={t.bookings}
      />

      {bookings.length > 0 ? (
        <section className="space-y-3" aria-labelledby="my-bookings-heading">
          <h2
            id="my-bookings-heading"
            className="flex items-center gap-2 text-lg font-bold text-ink"
          >
            <ClipboardTextIcon weight="duotone" className="size-5 text-brand" aria-hidden />
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
    <Page>
      <PageHeader title={t.bookings.myFarmTitle} />
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <MyFarmContent searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </Page>
  );
}
