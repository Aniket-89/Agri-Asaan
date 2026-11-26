import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowLeftIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  DroneIcon,
  NoteIcon,
  PhoneIcon,
  PlantIcon,
  SealCheckIcon,
  UserPlusIcon,
} from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { FieldMap } from "@/components/maps/field-map";
import { StatusBanner } from "@/components/shared/status-banner";
import {
  Button,
  buttonClass,
  controlClass,
  controlOnTintClass,
  Field,
  Page,
  Panel,
} from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  BOOKING_ERROR_CODES,
  canUseBookingInbox,
  getAssignmentOptions,
  getBookingDetail,
  type AssignmentOption,
  type AssignmentOptions,
} from "@/modules/bookings";
import {
  BookingJourney,
  BookingStatusBadge,
  Fact,
  formatAcres,
  formatBookingDate,
  formatSprayed,
} from "@/modules/bookings/components/booking-ui";
import { getActiveMembershipContext } from "@/modules/organizations";

import { PaymentPanel } from "@/modules/payments/components/payment-panel";
import { getJobPayment } from "@/modules/payments/payment.service";

import { assignBookingAction, changeBookingStatusAction, recordPaymentAction } from "../actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["booked", "updated", "assigned", "paid"]).optional().catch(undefined),
  error: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.bookings.detailTitle };
}

const reasonClass = controlOnTintClass;

async function BookingDetailContent({
  params,
  searchParams,
  t,
  maps,
  payments,
  locale,
}: {
  params: PageProps<"/[lang]/dashboard/bookings/[id]">["params"];
  searchParams: PageProps<"/[lang]/dashboard/bookings/[id]">["searchParams"];
  t: Dictionary["bookings"];
  maps: Dictionary["maps"];
  payments: Dictionary["payments"];
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
  const isFinished = booking.status === "completed" || booking.status === "verified";
  const [options, payment] = await Promise.all([
    booking.canAssign ? getAssignmentOptions(context, booking.id) : null,
    isFinished ? getJobPayment(context.supabase, booking.id) : null,
  ]);
  // Region managers can record a payment; the database re-checks the region.
  const canRecordPayment =
    context.role === "organization_admin" || context.role === "regional_admin";

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
      <a className={`${buttonClass({ variant: "quiet", size: "sm" })} -ml-3`} href={backHref}>
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t.backToBookings}
      </a>

      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      {search.status === "booked" ? <StatusBanner kind="success" text={t.booked} /> : null}
      {search.status === "updated" ? <StatusBanner kind="success" text={t.updated} /> : null}
      {search.status === "assigned" ? <StatusBanner kind="success" text={t.assigned} /> : null}
      {search.status === "paid" ? <StatusBanner kind="success" text={payments.recorded} /> : null}

      <section className="space-y-4 rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-muted">{t.detailTitle}</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {booking.farmer.fullName}
            </h1>
            <p className="text-ink-muted">{booking.villageName}</p>
          </div>
          <BookingStatusBadge status={booking.status} t={t} />
        </div>
        <BookingJourney status={booking.status} t={t} />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Fact icon={<CalendarBlankIcon weight="fill" className="size-4" />}>
            {formatBookingDate(booking.preferredDate, locale)}
          </Fact>
          {booking.slotLabel ? (
            <Fact icon={<ClockIcon weight="fill" className="size-4" />}>{booking.slotLabel}</Fact>
          ) : null}
        </div>
        <a
          className={buttonClass({ variant: "secondary", size: "sm" })}
          href={`tel:+91${booking.farmer.phone}`}
        >
          <PhoneIcon weight="fill" className="size-4 text-brand" aria-hidden />
          {booking.farmer.phone}
        </a>
        {booking.notes ? (
          <p className="flex gap-2 rounded-xl bg-sun-soft px-4 py-3 text-sm text-sun-ink">
            <NoteIcon weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
            {booking.notes}
          </p>
        ) : null}
      </section>

      <Panel
        id="lines"
        title={`${t.fields} (${formatAcres(booking.totalAcres, locale, t)})`}
        icon={<PlantIcon weight="duotone" className="size-5" />}
      >
        <div className="space-y-3">
          <FieldMap
            label={maps.bookingFields}
            labels={{ loading: maps.loading, failed: maps.failed }}
            pins={booking.lines.map((line) => ({
              id: line.fieldId,
              label: line.fieldName,
              detail: `${line.cropName}, ${formatAcres(line.areaAcres, locale, t)}`,
              latitude: line.latitude,
              longitude: line.longitude,
            }))}
          />
          <ul className="space-y-2">
            {booking.lines.map((line) => (
              <li key={line.fieldId} className="rounded-xl bg-canvas px-4 py-3">
                <p className="font-semibold text-ink">{line.fieldName}</p>
                <p className="text-sm text-ink-muted">
                  {line.cropName}, {formatAcres(line.areaAcres, locale, t)}
                </p>
                {line.actualAcres !== null ? (
                  <p className="mt-1 text-sm font-semibold text-leaf-ink">
                    {formatSprayed(line.actualAcres, line.areaAcres, locale, t)}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-ink-faint">
                  {line.latitude}, {line.longitude}
                </p>
              </li>
            ))}
          </ul>
          {booking.execution.actualTotalAcres !== null ? (
            <p className="rounded-xl bg-leaf-soft px-4 py-3 font-bold text-leaf-ink">
              {formatSprayed(
                booking.execution.actualTotalAcres,
                booking.totalAcres,
                locale,
                t,
                "totalSprayed"
              )}
            </p>
          ) : null}
          {booking.execution.completionNotes ? (
            <p className="flex gap-2 rounded-xl bg-canvas px-4 py-3 text-sm">
              <NoteIcon
                weight="fill"
                className="mt-0.5 size-4 shrink-0 text-ink-faint"
                aria-hidden
              />
              <span>
                <span className="font-semibold">{t.pilotNote}: </span>
                {booking.execution.completionNotes}
              </span>
            </p>
          ) : null}
        </div>
      </Panel>

      {payment ? (
        <Panel id="payment" title={payments.heading}>
          <PaymentPanel
            payment={payment}
            acres={booking.execution.actualTotalAcres}
            record={
              canRecordPayment
                ? { action: recordPaymentAction, bookingId: booking.id, returnTo: "booking" }
                : undefined
            }
            t={payments}
            locale={locale}
          />
        </Panel>
      ) : null}

      {booking.canAssign && options ? (
        <AssignmentSection
          bookingId={booking.id}
          assignment={booking.assignment}
          options={options}
          t={t}
        />
      ) : booking.assignment ? (
        <Panel
          id="assignment"
          title={t.assignment}
          icon={<DroneIcon weight="duotone" className="size-5" />}
        >
          <p>
            {format(t.assignedTo, {
              pilot: booking.assignment.pilotName,
              drone: booking.assignment.droneLabel,
            })}
          </p>
        </Panel>
      ) : null}

      {booking.actions.length > 0 ? (
        <Panel id="actions" title={t.actions}>
          <div className="space-y-4">
            {booking.actions.includes("confirm") ? (
              <form action={changeBookingStatusAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="toStatus" value="confirmed" />
                <Button
                  block
                  icon={<CheckCircleIcon weight="fill" className="size-5" aria-hidden />}
                >
                  {t.confirm}
                </Button>
              </form>
            ) : null}
            {booking.actions.includes("verify") ? (
              <form action={changeBookingStatusAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="toStatus" value="verified" />
                <Button block icon={<SealCheckIcon weight="fill" className="size-5" aria-hidden />}>
                  {t.verify}
                </Button>
              </form>
            ) : null}
            {booking.actions.includes("send_back") ? (
              <form
                action={changeBookingStatusAction}
                className="space-y-3 rounded-xl bg-canvas p-3"
              >
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="toStatus" value="in_progress" />
                <Field label={t.sendBackReason}>
                  <input name="reason" required maxLength={500} className={reasonClass} />
                </Field>
                <Button variant="secondary" block>
                  {t.sendBack}
                </Button>
              </form>
            ) : null}
            {booking.actions.includes("reject") ? (
              <form
                action={changeBookingStatusAction}
                className="space-y-3 rounded-xl bg-canvas p-3"
              >
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="toStatus" value="rejected" />
                <Field label={t.rejectReason}>
                  <input name="reason" required maxLength={500} className={reasonClass} />
                </Field>
                <Button variant="danger" block>
                  {t.reject}
                </Button>
              </form>
            ) : null}
            {booking.actions.includes("cancel") ? (
              <form
                action={changeBookingStatusAction}
                className="space-y-3 rounded-xl bg-canvas p-3"
              >
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="toStatus" value="cancelled" />
                <Field label={t.cancelReason}>
                  <input name="reason" maxLength={500} className={reasonClass} />
                </Field>
                <Button variant="secondary" block>
                  {t.cancel}
                </Button>
              </form>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel
        id="history"
        title={t.history}
        icon={<ClockCounterClockwiseIcon weight="duotone" className="size-5" />}
      >
        <ol className="space-y-4">
          {booking.history.map((entry, index) => (
            <li key={entry.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-3 shrink-0 rounded-full ${
                  index === booking.history.length - 1 ? "bg-brand" : "bg-leaf"
                }`}
              />
              <span className="min-w-0">
                <span className="block font-semibold text-ink">
                  {format(t.historyEntry, {
                    status: t.statuses[entry.toStatus],
                    actor: entry.actorName,
                  })}
                </span>
                <span className="block text-sm text-ink-muted">
                  {timeFormat.format(new Date(entry.createdAt))}
                </span>
                {entry.reason ? (
                  <span className="mt-1 block rounded-lg bg-canvas px-3 py-2 text-sm">
                    {entry.reason}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

function optionLabel(option: AssignmentOption, t: Dictionary["bookings"]): string {
  const extras = [
    !option.isHomeRegion && option.regionName
      ? format(t.otherRegion, { region: option.regionName })
      : null,
    option.isCurrent ? t.current : null,
  ].filter(Boolean);
  return extras.length > 0 ? `${option.label} (${extras.join(", ")})` : option.label;
}

function AssignmentSection({
  bookingId,
  assignment,
  options,
  t,
}: {
  bookingId: string;
  assignment: { pilotName: string; droneLabel: string } | null;
  options: AssignmentOptions;
  t: Dictionary["bookings"];
}) {
  const currentPilot = options.pilots.find((option) => option.isCurrent)?.id ?? "";
  const currentDrone = options.drones.find((option) => option.isCurrent)?.id ?? "";
  const canSubmit = options.pilots.length > 0 && options.drones.length > 0;

  return (
    <Panel
      id="assignment"
      title={t.assignment}
      icon={<DroneIcon weight="duotone" className="size-5" />}
    >
      <p className="mb-4 text-ink-muted">
        {assignment
          ? format(t.assignedTo, { pilot: assignment.pilotName, drone: assignment.droneLabel })
          : t.notAssigned}
      </p>
      <form action={assignBookingAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="bookingId" value={bookingId} />
        <Field label={t.pilot}>
          {options.pilots.length > 0 ? (
            <select
              name="pilotUserId"
              required
              defaultValue={currentPilot}
              className={controlClass}
            >
              <option value="" disabled>
                {t.choose}
              </option>
              {options.pilots.map((option) => (
                <option key={option.id} value={option.id}>
                  {optionLabel(option, t)}
                </option>
              ))}
            </select>
          ) : (
            <span className="block rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">
              {t.noFreePilots}
            </span>
          )}
        </Field>
        <Field label={t.drone}>
          {options.drones.length > 0 ? (
            <select name="droneId" required defaultValue={currentDrone} className={controlClass}>
              <option value="" disabled>
                {t.choose}
              </option>
              {options.drones.map((option) => (
                <option key={option.id} value={option.id}>
                  {optionLabel(option, t)}
                </option>
              ))}
            </select>
          ) : (
            <span className="block rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">
              {t.noFreeDrones}
            </span>
          )}
        </Field>
        <Button
          block
          disabled={!canSubmit}
          className="sm:col-span-2"
          icon={<UserPlusIcon weight="fill" className="size-5" aria-hidden />}
        >
          {assignment ? t.reassign : t.assign}
        </Button>
      </form>
    </Panel>
  );
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/bookings/[id]">) {
  const { locale, t } = await getDictionary();

  return (
    <Page>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <BookingDetailContent
          params={params}
          searchParams={searchParams}
          t={t.bookings}
          maps={t.maps}
          payments={t.payments}
          locale={locale}
        />
      </Suspense>
    </Page>
  );
}
