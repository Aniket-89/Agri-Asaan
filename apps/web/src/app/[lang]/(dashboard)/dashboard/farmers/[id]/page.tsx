import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import { UseLocationButton } from "@/components/shared/use-location-button";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  BOOKING_ERROR_CODES,
  bookingDateWindow,
  listFarmerBookings,
  listOpenBookedFieldIds,
} from "@/modules/bookings";
import { BookingForm, BookingList } from "@/modules/bookings/components/booking-ui";
import { getFarmer } from "@/modules/farmers";
import { listCropOptions, listFarmerFields } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

import { createBookingAction } from "../../bookings/actions";
import { addFieldAction } from "../actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["saved"]).optional().catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
  bookingError: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.farmers.title };
}

const inputClass = "min-h-11 w-full rounded border px-3 py-2";

async function FarmerDetailContent({
  params,
  searchParams,
  t,
  locale,
}: {
  params: PageProps<"/[lang]/dashboard/farmers/[id]">["params"];
  searchParams: PageProps<"/[lang]/dashboard/farmers/[id]">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }

  const farmerId = z.uuid().safeParse((await params).id);
  if (!farmerId.success) {
    notFound();
  }

  const farmer = await getFarmer(context, farmerId.data);
  if (!farmer) {
    notFound();
  }

  const [fields, crops, search, bookings, bookedFieldIds] = await Promise.all([
    listFarmerFields(context, farmer.id, locale),
    listCropOptions(context, locale),
    searchParams.then((value) => searchSchema.parse(value)),
    listFarmerBookings(context, farmer.id),
    listOpenBookedFieldIds(context, farmer.id),
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
  });
  const areaFormat = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    maximumFractionDigits: 2,
  });

  return (
    <>
      <section className="space-y-1 rounded-xl border p-4">
        <h1 className="text-2xl font-semibold">
          {farmer.fullName}
          {farmer.isActive ? null : (
            <span className="ml-2 text-base font-normal">({t.farmers.inactive})</span>
          )}
        </h1>
        <p>{farmer.villageName}</p>
        <p>
          <a className="underline" href={`tel:+91${farmer.phone}`}>
            {farmer.phone}
          </a>
        </p>
        <p className="text-sm text-gray-600">
          {format(t.farmers.registeredOn, { date: dateFormat.format(new Date(farmer.createdAt)) })}
        </p>
      </section>

      {search.error ? <StatusBanner kind="error" text={t.farmers.errors[search.error]} /> : null}
      {search.status === "saved" ? <StatusBanner kind="success" text={t.fields.saved} /> : null}

      <section className="space-y-3" aria-labelledby="fields-heading">
        <h2 id="fields-heading" className="text-xl font-semibold">
          {t.fields.heading}
        </h2>
        {fields.length === 0 ? <p className="text-gray-600">{t.fields.none}</p> : null}
        <ul className="space-y-2">
          {fields.map((field) => (
            <li key={field.id} className="rounded border p-3">
              <p className="font-medium">{field.name}</p>
              <p className="text-sm">
                {field.cropName} ·{" "}
                {format(t.fields.acres, { area: areaFormat.format(field.areaAcres) })}
              </p>
              <p className="text-sm text-gray-600">
                {field.latitude}, {field.longitude}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <form
        action={addFieldAction}
        className="grid gap-3 rounded-xl border border-dashed p-4 sm:grid-cols-2"
      >
        <h2 className="text-lg font-semibold sm:col-span-2">{t.fields.add}</h2>
        <input type="hidden" name="farmerId" value={farmer.id} />
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm">{t.fields.name}</span>
          <input name="name" required maxLength={120} className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm">{t.fields.crop}</span>
          <select name="cropId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              {t.fields.chooseCrop}
            </option>
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm">{t.fields.area}</span>
          <input
            name="areaAcres"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="10000"
            required
            className={inputClass}
          />
        </label>
        <p className="text-sm text-gray-600 sm:col-span-2">{t.fields.pinHint}</p>
        <div className="sm:col-span-2">
          <UseLocationButton
            latitudeName="latitude"
            longitudeName="longitude"
            labels={{
              idle: t.fields.useMyLocation,
              locating: t.fields.locating,
              unavailable: t.fields.locationUnavailable,
            }}
          />
        </div>
        <label>
          <span className="mb-1 block text-sm">{t.fields.latitude}</span>
          <input
            name="latitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            min="-90"
            max="90"
            required
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm">{t.fields.longitude}</span>
          <input
            name="longitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            min="-180"
            max="180"
            required
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded bg-black px-4 py-3 text-white sm:col-span-2"
        >
          {t.fields.submit}
        </button>
      </form>

      {search.bookingError ? (
        <StatusBanner kind="error" text={t.bookings.errors[search.bookingError]} />
      ) : null}
      {farmer.isActive ? (
        <BookingForm
          farmerId={farmer.id}
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
          returnTo="farmer"
          action={createBookingAction}
          locale={locale}
          t={t.bookings}
        />
      ) : null}

      {bookings.length > 0 ? (
        <section className="space-y-2" aria-labelledby="farmer-bookings-heading">
          <h2 id="farmer-bookings-heading" className="text-xl font-semibold">
            {t.bookings.farmerBookings}
          </h2>
          <BookingList bookings={bookings} locale={locale} t={t.bookings} showFarmer={false} />
        </section>
      ) : null}
    </>
  );
}

export default async function FarmerDetailPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/farmers/[id]">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <a
        className="inline-block min-h-11 py-2 text-sm underline"
        href={withLocale(locale, "/dashboard/farmers")}
      >
        ← {t.farmers.backToFarmers}
      </a>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <FarmerDetailContent params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </main>
  );
}
