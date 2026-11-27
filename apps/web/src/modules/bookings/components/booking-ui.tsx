import Link from "next/link";
import {
  CalendarBlankIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DroneIcon,
  FlagCheckeredIcon,
  HourglassIcon,
  MapPinIcon,
  PlantIcon,
  PlayIcon,
  ProhibitIcon,
  SealCheckIcon,
  UserIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { Badge, Button, controlClass, Field, type BadgeTone } from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import type { BookingStatus } from "../booking.rules";
import type { BookingListItem, SlotOption } from "../booking.service";

type FormAction = (formData: FormData) => Promise<void>;

const STATUS_LOOK: Record<BookingStatus, { tone: BadgeTone; Icon: typeof HourglassIcon }> = {
  requested: { tone: "sun", Icon: HourglassIcon },
  confirmed: { tone: "sky", Icon: CheckCircleIcon },
  rejected: { tone: "clay", Icon: XCircleIcon },
  cancelled: { tone: "neutral", Icon: ProhibitIcon },
  assigned: { tone: "sky", Icon: DroneIcon },
  in_progress: { tone: "leaf", Icon: PlayIcon },
  completed: { tone: "leaf", Icon: FlagCheckeredIcon },
  verified: { tone: "brand", Icon: SealCheckIcon },
};

export function BookingStatusBadge({
  status,
  t,
}: {
  status: BookingStatus;
  t: Dictionary["bookings"];
}) {
  const { tone, Icon } = STATUS_LOOK[status];
  return (
    <Badge tone={tone} icon={<Icon weight="fill" className="size-4" aria-hidden />}>
      {t.statuses[status]}
    </Badge>
  );
}

// The happy path of a booking, in order. Rejected and cancelled bookings
// leave it, so they show only their badge.
const JOURNEY: readonly BookingStatus[] = [
  "requested",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
  "verified",
];

// A row of field strips that fill with green as the booking moves along.
export function BookingJourney({
  status,
  t,
}: {
  status: BookingStatus;
  t: Dictionary["bookings"];
}) {
  const current = JOURNEY.indexOf(status);
  if (current < 0) {
    return null;
  }
  return (
    <div>
      <ol
        aria-label={format(t.progress, {
          step: String(current + 1),
          total: String(JOURNEY.length),
          status: t.statuses[status],
        })}
        className="grid grid-cols-6 gap-1.5"
      >
        {JOURNEY.map((step, index) => (
          <li key={step} className="min-w-0 space-y-1.5">
            <span
              aria-hidden="true"
              className={`block h-2 rounded-full ${
                index < current
                  ? "bg-leaf"
                  : index === current
                    ? "bg-brand shadow-[0_0_0_3px_var(--color-leaf-soft)]"
                    : "bg-field shadow-inset"
              }`}
            />
            <span
              className={`hidden truncate text-xs sm:block ${
                index === current ? "font-bold text-brand" : "text-ink-faint"
              }`}
            >
              {t.statuses[step]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function formatBookingDate(date: string, locale: Locale): string {
  // Dates are calendar days (no time zone); render them as such.
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatAcres(area: number, locale: Locale, t: Dictionary["bookings"]): string {
  const number = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    maximumFractionDigits: 2,
  }).format(area);
  return format(t.totalAcres, { area: number });
}

// Mission-plan area against the booked acres, e.g. "Sprayed 4.3 acres ·
// booked 4 acres (+0.3)". The difference is omitted when they match.
export function formatSprayed(
  actual: number,
  booked: number,
  locale: Locale,
  t: Dictionary["bookings"],
  template: "sprayed" | "totalSprayed" = "sprayed"
): string {
  const difference = Math.round((actual - booked) * 100) / 100;
  const diff =
    difference === 0
      ? ""
      : ` (${new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
          maximumFractionDigits: 2,
          signDisplay: "always",
        }).format(difference)})`;
  return format(t[template], {
    actual: formatAcres(actual, locale, t),
    area: formatAcres(booked, locale, t),
    diff,
  });
}

// One small fact with its icon, used instead of dot-joined text.
export function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
      <span className="text-ink-faint" aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  );
}

export function BookingList({
  bookings,
  locale,
  t,
  showFarmer = true,
}: {
  bookings: BookingListItem[];
  locale: Locale;
  t: Dictionary["bookings"];
  showFarmer?: boolean;
}) {
  return (
    <ul className="space-y-1 rounded-2xl bg-surface p-1.5 shadow-soft">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link
            href={withLocale(locale, `/dashboard/bookings/${booking.id}`)}
            className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-canvas"
          >
            {showFarmer ? (
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-brand"
              >
                <UserIcon weight="fill" className="size-5" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="truncate font-semibold text-ink">
                  {showFarmer
                    ? booking.farmerName
                    : formatBookingDate(booking.preferredDate, locale)}
                </span>
                <BookingStatusBadge status={booking.status} t={t} />
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {showFarmer ? (
                  <>
                    <Fact icon={<MapPinIcon weight="fill" className="size-4" />}>
                      {booking.villageName}
                    </Fact>
                    <Fact icon={<CalendarBlankIcon weight="fill" className="size-4" />}>
                      {formatBookingDate(booking.preferredDate, locale)}
                    </Fact>
                  </>
                ) : null}
                <Fact icon={<PlantIcon weight="fill" className="size-4" />}>
                  {formatAcres(booking.totalAcres, locale, t)}
                </Fact>
              </span>
            </span>
            <CaretRightIcon className="size-5 shrink-0 text-ink-faint" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type BookableField = {
  id: string;
  name: string;
  cropName: string;
  areaAcres: number;
  alreadyBooked: boolean;
};

export function BookingForm({
  farmerId,
  fields,
  dateWindow,
  selectedDate,
  slots,
  returnTo,
  action,
  locale,
  t,
}: {
  farmerId: string;
  fields: BookableField[];
  dateWindow: { min: string; max: string };
  // The date whose slots are listed; chosen with the GET form below.
  selectedDate: string;
  slots: SlotOption[];
  returnTo: "farmer" | "my-farm";
  action: FormAction;
  locale: Locale;
  t: Dictionary["bookings"];
}) {
  const bookable = fields.filter((field) => !field.alreadyBooked);
  const openSlots = slots.filter((slot) => slot.available > 0);

  // Selectable rows: a filled tile that lifts and tints when chosen, no outlines.
  const choice =
    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl bg-canvas px-4 py-3 transition has-checked:bg-brand-soft has-checked:shadow-soft has-disabled:cursor-not-allowed has-disabled:opacity-55";
  const tick = "size-5 shrink-0 accent-[var(--brand)]";

  return (
    <section
      id="book"
      className="scroll-mt-20 space-y-5 rounded-2xl bg-surface p-4 shadow-soft sm:p-6"
      aria-labelledby="book-heading"
    >
      <h2 id="book-heading" className="flex items-center gap-2 text-xl font-bold text-ink">
        <CalendarBlankIcon weight="duotone" className="size-6 text-brand" aria-hidden />
        {t.bookHeading}
      </h2>
      {bookable.length === 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">
          {t.noBookableFields}
        </p>
      ) : (
        <>
          {/* Step 1: pick a date. A plain GET form, so it works without JavaScript. */}
          <form method="get" action="#book" className="flex items-end gap-2">
            <Field label={t.preferredDate} className="min-w-0 flex-1">
              <input
                name="slotDate"
                type="date"
                required
                min={dateWindow.min}
                max={dateWindow.max}
                defaultValue={selectedDate}
                className={controlClass}
              />
            </Field>
            <Button variant="secondary">{t.showSlots}</Button>
          </form>

          {/* Step 2: pick fields and one of that date's slots. */}
          <form action={action} className="space-y-5">
            {/* Fresh id per rendered form: resubmitting the same form cannot create a duplicate. */}
            <input type="hidden" name="id" value={crypto.randomUUID()} />
            <input type="hidden" name="farmerId" value={farmerId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="preferredDate" value={selectedDate} />

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-ink">
                {format(t.slotsFor, { date: formatBookingDate(selectedDate, locale) })}
              </legend>
              {slots.length === 0 ? (
                <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">{t.noSlots}</p>
              ) : null}
              {slots.map((slot) => {
                const full = slot.available <= 0;
                return (
                  <label key={slot.id} className={choice}>
                    <input
                      type="radio"
                      name="slotId"
                      value={slot.id}
                      required
                      disabled={full}
                      defaultChecked={openSlots.length === 1 && !full}
                      className={tick}
                    />
                    <ClockIcon
                      weight="duotone"
                      className="size-5 shrink-0 text-brand"
                      aria-hidden
                    />
                    <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{slot.label}</span>
                      <span
                        className={`text-sm font-semibold ${full ? "text-clay" : "text-leaf-ink"}`}
                      >
                        {full ? t.slotFull : format(t.placesLeft, { count: slot.available })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-ink">{t.chooseFields}</legend>
              {fields.map((field) => (
                <label key={field.id} className={choice}>
                  <input
                    type="checkbox"
                    name="fieldIds"
                    value={field.id}
                    disabled={field.alreadyBooked}
                    defaultChecked={bookable.length === 1 && !field.alreadyBooked}
                    className={tick}
                  />
                  <PlantIcon weight="duotone" className="size-5 shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{field.name}</span>
                    <span className="block text-sm text-ink-muted">
                      {field.cropName}, {formatAcres(field.areaAcres, locale, t)}
                    </span>
                    {field.alreadyBooked ? (
                      <span className="block text-xs font-semibold text-sun-ink">
                        {t.alreadyBooked}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>

            <Field label={t.notes}>
              <textarea name="notes" maxLength={500} rows={3} className={controlClass} />
            </Field>
            <Button block disabled={openSlots.length === 0}>
              {t.submitBooking}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
