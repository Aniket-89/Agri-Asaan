import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import type { BookingStatus } from "../booking.rules";
import type { BookingListItem, SlotOption } from "../booking.service";

type FormAction = (formData: FormData) => Promise<void>;

const STATUS_STYLES: Record<BookingStatus, string> = {
  requested: "bg-amber-100 text-amber-900",
  confirmed: "bg-blue-100 text-blue-900",
  rejected: "bg-red-100 text-red-900",
  cancelled: "bg-gray-200 text-gray-800",
  assigned: "bg-indigo-100 text-indigo-900",
  in_progress: "bg-purple-100 text-purple-900",
  completed: "bg-green-100 text-green-900",
  verified: "bg-emerald-200 text-emerald-950",
};

export function BookingStatusBadge({
  status,
  t,
}: {
  status: BookingStatus;
  t: Dictionary["bookings"];
}) {
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {t.statuses[status]}
    </span>
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
    <ul className="divide-y rounded-xl border">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <a
            href={withLocale(locale, `/dashboard/bookings/${booking.id}`)}
            className="flex min-h-14 flex-col gap-1 px-4 py-3 hover:bg-gray-50"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {showFarmer ? booking.farmerName : formatBookingDate(booking.preferredDate, locale)}
              </span>
              <BookingStatusBadge status={booking.status} t={t} />
            </span>
            <span className="text-sm text-gray-600">
              {showFarmer
                ? `${booking.villageName} · ${formatBookingDate(booking.preferredDate, locale)} · `
                : ""}
              {formatAcres(booking.totalAcres, locale, t)}
            </span>
          </a>
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

  return (
    <section
      className="space-y-3 rounded-xl border border-dashed p-4"
      aria-labelledby="book-heading"
    >
      <h2 id="book-heading" className="text-lg font-semibold">
        {t.bookHeading}
      </h2>
      {bookable.length === 0 ? (
        <p className="text-sm text-gray-600">{t.noBookableFields}</p>
      ) : (
        <>
          {/* Step 1: pick a date. A plain GET form, so it works without JavaScript. */}
          <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-sm">{t.preferredDate}</span>
              <input
                name="slotDate"
                type="date"
                required
                min={dateWindow.min}
                max={dateWindow.max}
                defaultValue={selectedDate}
                className="min-h-11 w-full rounded border px-3 py-2"
              />
            </label>
            <button type="submit" className="min-h-11 rounded border px-4 py-2">
              {t.showSlots}
            </button>
          </form>

          {/* Step 2: pick fields and one of that date's slots. */}
          <form action={action} className="space-y-4">
            {/* Fresh id per rendered form: resubmitting the same form cannot create a duplicate. */}
            <input type="hidden" name="id" value={crypto.randomUUID()} />
            <input type="hidden" name="farmerId" value={farmerId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="preferredDate" value={selectedDate} />

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">
                {format(t.slotsFor, { date: formatBookingDate(selectedDate, locale) })}
              </legend>
              {slots.length === 0 ? <p className="text-sm text-gray-600">{t.noSlots}</p> : null}
              {slots.map((slot) => {
                const full = slot.available <= 0;
                return (
                  <label
                    key={slot.id}
                    className={`flex min-h-11 items-center gap-3 rounded border px-3 py-2 ${
                      full ? "opacity-60" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="slotId"
                      value={slot.id}
                      required
                      disabled={full}
                      defaultChecked={openSlots.length === 1 && !full}
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="flex flex-1 flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium">{slot.label}</span>
                      <span>
                        {full ? t.slotFull : format(t.placesLeft, { count: slot.available })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{t.chooseFields}</legend>
              {fields.map((field) => (
                <label
                  key={field.id}
                  className={`flex min-h-11 items-center gap-3 rounded border px-3 py-2 ${
                    field.alreadyBooked ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    name="fieldIds"
                    value={field.id}
                    disabled={field.alreadyBooked}
                    defaultChecked={bookable.length === 1 && !field.alreadyBooked}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{field.name}</span> · {field.cropName} ·{" "}
                    {formatAcres(field.areaAcres, locale, t)}
                    {field.alreadyBooked ? (
                      <span className="block text-xs">{t.alreadyBooked}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-sm">{t.notes}</span>
              <textarea
                name="notes"
                maxLength={500}
                rows={3}
                className="w-full rounded border px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={openSlots.length === 0}
              className="min-h-11 w-full rounded bg-black px-4 py-3 text-white disabled:opacity-50"
            >
              {t.submitBooking}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
