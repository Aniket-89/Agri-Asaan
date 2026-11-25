import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  CalendarCheckIcon,
  ClipboardTextIcon,
  MapPinIcon,
  PhoneIcon,
  PlantIcon,
  PlusIcon,
} from "@phosphor-icons/react/dist/ssr";

import { FieldMap } from "@/components/maps/field-map";
import { PinPicker } from "@/components/maps/pin-picker";
import { StatusBanner } from "@/components/shared/status-banner";
import { UseLocationButton } from "@/components/shared/use-location-button";
import {
  BackLink,
  Badge,
  Button,
  buttonClass,
  controlOnTintClass,
  Field,
  Page,
  Panel,
} from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  BOOKING_ERROR_CODES,
  bookingDateWindow,
  getSlotAvailability,
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
  slotDate: z.iso.date().optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.farmers.title };
}

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
  const dateWindow = bookingDateWindow(new Date());
  const selectedDate =
    search.slotDate && search.slotDate >= dateWindow.min && search.slotDate <= dateWindow.max
      ? search.slotDate
      : dateWindow.min;
  const slots = farmer.isActive
    ? await getSlotAvailability(context, farmer.id, selectedDate, locale)
    : [];
  const dateFormat = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
  });
  const areaFormat = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    maximumFractionDigits: 2,
  });

  const acres = (area: number) => format(t.fields.acres, { area: areaFormat.format(area) });

  return (
    <>
      <section className="space-y-4 rounded-2xl bg-surface p-4 shadow-soft sm:p-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-soft text-2xl font-bold text-sky"
          >
            {farmer.fullName.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-ink">
              {farmer.fullName}
              {farmer.isActive ? null : <Badge tone="neutral">{t.farmers.inactive}</Badge>}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
              <MapPinIcon weight="fill" className="size-4 text-ink-faint" aria-hidden />
              {farmer.villageName}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
              <CalendarCheckIcon weight="fill" className="size-4 text-ink-faint" aria-hidden />
              {format(t.farmers.registeredOn, {
                date: dateFormat.format(new Date(farmer.createdAt)),
              })}
            </p>
          </div>
        </div>
        <a className={buttonClass({ variant: "secondary" })} href={`tel:+91${farmer.phone}`}>
          <PhoneIcon weight="fill" className="size-5 text-brand" aria-hidden />
          <span className="tabular-nums">{farmer.phone}</span>
        </a>
      </section>

      {search.error ? <StatusBanner kind="error" text={t.farmers.errors[search.error]} /> : null}
      {search.status === "saved" ? <StatusBanner kind="success" text={t.fields.saved} /> : null}

      <Panel
        id="fields"
        title={t.fields.heading}
        icon={<PlantIcon weight="duotone" className="size-5" />}
      >
        <div className="space-y-3">
          {fields.length === 0 ? <p className="text-ink-muted">{t.fields.none}</p> : null}
          <FieldMap
            label={format(t.maps.farmerFields, { name: farmer.fullName })}
            labels={{ loading: t.maps.loading, failed: t.maps.failed }}
            pins={fields.map((field) => ({
              id: field.id,
              label: field.name,
              detail: `${field.cropName}, ${acres(field.areaAcres)}`,
              latitude: field.latitude,
              longitude: field.longitude,
              boundary: field.boundary,
            }))}
          />
          <ul className="space-y-2">
            {fields.map((field) => (
              <li key={field.id} className="rounded-xl bg-canvas px-4 py-3">
                <p className="font-semibold text-ink">{field.name}</p>
                <p className="text-sm text-ink-muted">
                  {field.cropName}, {acres(field.areaAcres)}
                </p>
                <p className="text-xs text-ink-faint tabular-nums">
                  {field.latitude}, {field.longitude}
                </p>
              </li>
            ))}
          </ul>

          {/* Collapsed by default: adding a field is occasional, the list is the main content. */}
          <details className="group rounded-xl bg-canvas" open={fields.length === 0}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-brand [&::-webkit-details-marker]:hidden">
              <PlusIcon weight="bold" className="size-5" aria-hidden />
              {t.fields.add}
            </summary>
            <form action={addFieldAction} className="grid gap-4 p-4 pt-1 sm:grid-cols-2">
              <input type="hidden" name="farmerId" value={farmer.id} />
              <Field label={t.fields.name} className="sm:col-span-2">
                <input name="name" required maxLength={120} className={controlOnTintClass} />
              </Field>
              <Field label={t.fields.crop}>
                <select name="cropId" required defaultValue="" className={controlOnTintClass}>
                  <option value="" disabled>
                    {t.fields.chooseCrop}
                  </option>
                  {crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.fields.area}>
                <input
                  name="areaAcres"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max="10000"
                  required
                  className={controlOnTintClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <PinPicker
                  latitudeName="latitude"
                  longitudeName="longitude"
                  center={farmer.villageLocation}
                  label={t.maps.picker}
                  labels={{ hint: t.maps.pickHint, loading: t.maps.loading, failed: t.maps.failed }}
                />
              </div>
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
              <Field label={t.fields.latitude}>
                <input
                  name="latitude"
                  type="number"
                  inputMode="decimal"
                  step="0.000001"
                  min="-90"
                  max="90"
                  required
                  className={controlOnTintClass}
                />
              </Field>
              <Field label={t.fields.longitude}>
                <input
                  name="longitude"
                  type="number"
                  inputMode="decimal"
                  step="0.000001"
                  min="-180"
                  max="180"
                  required
                  className={controlOnTintClass}
                />
              </Field>
              <Button className="sm:col-span-2" block>
                {t.fields.submit}
              </Button>
            </form>
          </details>
        </div>
      </Panel>

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
          dateWindow={dateWindow}
          selectedDate={selectedDate}
          slots={slots}
          returnTo="farmer"
          action={createBookingAction}
          locale={locale}
          t={t.bookings}
        />
      ) : null}

      {bookings.length > 0 ? (
        <section className="space-y-3" aria-labelledby="farmer-bookings-heading">
          <h2
            id="farmer-bookings-heading"
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

export default async function FarmerDetailPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/farmers/[id]">) {
  const { locale, t } = await getDictionary();

  return (
    <Page>
      <BackLink href={withLocale(locale, "/dashboard/farmers")}>{t.farmers.backToFarmers}</BackLink>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <FarmerDetailContent params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </Page>
  );
}
