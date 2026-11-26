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
} from "@phosphor-icons/react/dist/ssr";

import { FieldMap } from "@/components/maps/field-map";
import { StatusBanner } from "@/components/shared/status-banner";
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
import { getFarmer, listPlacementVillages } from "@/modules/farmers";
import { listCropOptions, listFarmerFields } from "@/modules/fields";
import { AddFieldForm } from "@/modules/fields/components/add-field-form";
import { getActiveMembershipContext } from "@/modules/organizations";

import { createBookingAction } from "../../bookings/actions";
import { addFieldAction, placeFarmerAction } from "../actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["saved", "placed"]).optional().catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
  bookingError: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
  slotDate: z.iso.date().optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.farmers.title };
}

// A regional admin (or organization admin) puts a farmer who registered by
// address into a village (ADR 0021). The database re-checks both scopes.
function PlaceFarmerForm({
  farmerId,
  villages,
  t,
}: {
  farmerId: string;
  villages: { id: string; name: string }[];
  t: Dictionary["farmers"];
}) {
  if (villages.length === 0) {
    return <p className="text-sm text-ink-muted">{t.waitingForPlacement}</p>;
  }
  return (
    <form action={placeFarmerAction} className="space-y-2 rounded-xl bg-canvas p-4">
      <input type="hidden" name="farmerId" value={farmerId} />
      <Field label={t.placeInVillage} hint={t.placeHint}>
        <select name="villageId" required defaultValue="" className={controlOnTintClass}>
          <option value="" disabled>
            {t.chooseVillage}
          </option>
          {villages.map((village) => (
            <option key={village.id} value={village.id}>
              {village.name}
            </option>
          ))}
        </select>
      </Field>
      <Button variant="secondary" block>
        {t.placeSubmit}
      </Button>
    </form>
  );
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

  const [fields, crops, search, bookings, bookedFieldIds, placementVillages] = await Promise.all([
    listFarmerFields(context, farmer.id, locale),
    listCropOptions(context, locale),
    searchParams.then((value) => searchSchema.parse(value)),
    listFarmerBookings(context, farmer.id),
    listOpenBookedFieldIds(context, farmer.id),
    listPlacementVillages(context, farmer),
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
              {farmer.villageName ? null : (
                <Badge tone="neutral">
                  {farmer.hasRegion ? t.farmers.notPlaced : t.farmers.outsideArea}
                </Badge>
              )}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
              <MapPinIcon weight="fill" className="size-4 text-ink-faint" aria-hidden />
              {farmer.villageName ?? farmer.locality}
              {farmer.regionName ? `, ${farmer.regionName}` : null}
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
        {farmer.addressLine ? (
          <div className="rounded-xl bg-canvas px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{t.farmers.address}</p>
            <p className="text-ink-muted">
              {[
                farmer.addressLine,
                farmer.locality,
                farmer.tehsilName,
                farmer.districtName,
                farmer.pincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ) : null}
        {farmer.villageId ? null : (
          <PlaceFarmerForm farmerId={farmer.id} villages={placementVillages} t={t.farmers} />
        )}
      </section>

      {search.error ? <StatusBanner kind="error" text={t.farmers.errors[search.error]} /> : null}
      {search.status === "saved" ? <StatusBanner kind="success" text={t.fields.saved} /> : null}
      {search.status === "placed" ? <StatusBanner kind="success" text={t.farmers.placed} /> : null}

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

          <AddFieldForm
            action={addFieldAction}
            farmerId={farmer.id}
            crops={crops}
            center={farmer.villageLocation}
            open={fields.length === 0}
            t={t}
          />
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
