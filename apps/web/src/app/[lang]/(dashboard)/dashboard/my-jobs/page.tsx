import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ClockIcon,
  DroneIcon,
  FlagCheckeredIcon,
  ListChecksIcon,
  MapPinIcon,
  MapTrifoldIcon,
  NavigationArrowIcon,
  NoteIcon,
  PhoneIcon,
  PlayIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { FieldMap } from "@/components/maps/field-map";
import { StatusBanner } from "@/components/shared/status-banner";
import {
  Button,
  buttonClass,
  controlOnTintClass,
  EmptyState,
  Field,
  Page,
  PageHeader,
  SegmentedTabs,
  PageSkeleton,
} from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  BOOKING_ERROR_CODES,
  listMyJobs,
  PILOT_JOB_TABS,
  type PilotJob,
  type PilotJobTab,
} from "@/modules/bookings";
import {
  BookingStatusBadge,
  Fact,
  formatAcres,
  formatBookingDate,
  formatSprayed,
} from "@/modules/bookings/components/booking-ui";
import { getActiveMembershipContext } from "@/modules/organizations";

import { PaymentPanel } from "@/modules/payments/components/payment-panel";
import { getJobPayment, type JobPayment } from "@/modules/payments/payment.service";

import { recordPaymentAction } from "../bookings/actions";
import { completeJobAction, startJobAction } from "./actions";

export const instant = false;

const searchSchema = z.object({
  tab: z.enum(PILOT_JOB_TABS).catch("today"),
  status: z.enum(["started", "completed", "paid"]).optional().catch(undefined),
  error: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.jobs.title };
}

// OpenStreetMap link for a field pin (no paid map provider in the MVP).
const mapHref = (latitude: number, longitude: number) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

const icon = "size-4";

function JobProgress({
  job,
  payment,
  t,
  locale,
}: {
  job: PilotJob;
  payment: JobPayment | null;
  t: Dictionary;
  locale: Locale;
}) {
  if (job.status === "completed" || job.status === "verified") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5 rounded-xl bg-leaf-soft p-4 text-sm text-leaf-ink">
          {job.fields.map((field) => (
            <p key={field.fieldId}>
              <span className="font-semibold">{field.fieldName}: </span>
              {formatSprayed(field.actualAcres ?? 0, field.areaAcres, locale, t.bookings)}
            </p>
          ))}
          {job.actualTotalAcres !== null ? (
            <p className="pt-1 text-base font-bold">
              {formatSprayed(
                job.actualTotalAcres,
                job.totalAcres,
                locale,
                t.bookings,
                "totalSprayed"
              )}
            </p>
          ) : null}
          {job.status === "completed" ? <p>{t.jobs.awaitingVerification}</p> : null}
        </div>
        {payment ? (
          <PaymentPanel
            payment={payment}
            acres={job.actualTotalAcres}
            record={{ action: recordPaymentAction, bookingId: job.bookingId, returnTo: "jobs" }}
            t={t.payments}
            locale={locale}
          />
        ) : null}
      </div>
    );
  }
  if (job.status === "assigned") {
    return job.canStart ? (
      <form action={startJobAction}>
        <input type="hidden" name="bookingId" value={job.bookingId} />
        <Button block icon={<PlayIcon weight="fill" className="size-5" aria-hidden />}>
          {t.jobs.start}
        </Button>
      </form>
    ) : (
      <p className="flex items-center gap-2 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">
        <ClockIcon weight="duotone" className="size-5 shrink-0" aria-hidden />
        {t.jobs.startOnDay}
      </p>
    );
  }

  return (
    <form action={completeJobAction} className="space-y-4 rounded-xl bg-canvas p-4">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <FlagCheckeredIcon weight="duotone" className="size-5 text-brand" aria-hidden />
        {t.jobs.finishHeading}
      </h3>
      {job.sentBackReason ? (
        <StatusBanner kind="error" text={format(t.jobs.sentBack, { reason: job.sentBackReason })} />
      ) : null}
      <input type="hidden" name="bookingId" value={job.bookingId} />
      {job.fields.map((field) => (
        <Field
          key={field.fieldId}
          label={field.fieldName}
          hint={format(t.jobs.acresSprayed, {
            area: formatAcres(field.areaAcres, locale, t.bookings),
          })}
        >
          <input type="hidden" name="fieldIds" value={field.fieldId} />
          <input
            name="acres"
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={field.areaAcres * 2}
            step="0.01"
            defaultValue={field.actualAcres ?? field.areaAcres}
            className={`${controlOnTintClass} text-lg font-semibold`}
          />
        </Field>
      ))}
      <Field label={t.jobs.notes}>
        <textarea name="notes" maxLength={500} rows={2} className={controlOnTintClass} />
      </Field>
      <Button block icon={<FlagCheckeredIcon weight="fill" className="size-5" aria-hidden />}>
        {t.jobs.complete}
      </Button>
    </form>
  );
}

function JobCard({
  job,
  payment,
  t,
  locale,
}: {
  job: PilotJob;
  payment: JobPayment | null;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <li className="space-y-4 rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold text-ink">{formatBookingDate(job.date, locale)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
            <ClockIcon weight="fill" className={`${icon} text-leaf`} aria-hidden />
            {job.slotLabel}
          </p>
        </div>
        <BookingStatusBadge status={job.status} t={t.bookings} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Fact icon={<UserIcon weight="fill" className={icon} />}>{job.farmerName}</Fact>
        <Fact icon={<MapPinIcon weight="fill" className={icon} />}>{job.villageName}</Fact>
        <Fact icon={<DroneIcon weight="fill" className={icon} />}>
          {format(t.jobs.drone, { uid: job.droneUid })}
        </Fact>
      </div>

      <a
        className={buttonClass({ variant: "secondary", block: true })}
        href={`tel:+91${job.farmerPhone}`}
      >
        <PhoneIcon weight="fill" className="size-5 text-brand" aria-hidden />
        {format(t.jobs.call, { name: job.farmerName })}
      </a>

      {job.notes ? (
        <p className="flex gap-2 rounded-xl bg-sun-soft px-4 py-3 text-sm text-sun-ink">
          <NoteIcon weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
          {job.notes}
        </p>
      ) : null}

      <div className="space-y-2">
        <h3 className="font-bold text-ink">
          {t.jobs.fields} ({formatAcres(job.totalAcres, locale, t.bookings)})
        </h3>
        <ul className="space-y-2">
          {job.fields.map((field) => (
            <li
              key={field.fieldId}
              className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{field.fieldName}</span>
                <span className="block text-sm text-ink-muted">
                  {field.cropName}, {formatAcres(field.areaAcres, locale, t.bookings)}
                </span>
              </span>
              <a
                className={buttonClass({ variant: "quiet", size: "sm" })}
                href={mapHref(field.latitude, field.longitude)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <NavigationArrowIcon weight="fill" className="size-4" aria-hidden />
                {t.jobs.openMap}
              </a>
            </li>
          ))}
        </ul>
        {/* Collapsed so a list of jobs doesn't load many maps at once. */}
        <details className="group rounded-xl bg-canvas">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
            <MapTrifoldIcon weight="duotone" className="size-5" aria-hidden />
            {t.maps.showMap}
          </summary>
          <div className="p-2 pt-0">
            <FieldMap
              label={t.maps.jobFields}
              labels={{ loading: t.maps.loading, failed: t.maps.failed }}
              pins={job.fields.map((field) => ({
                id: field.fieldId,
                label: field.fieldName,
                detail: `${field.cropName}, ${formatAcres(field.areaAcres, locale, t.bookings)}`,
                latitude: field.latitude,
                longitude: field.longitude,
              }))}
            />
          </div>
        </details>
      </div>

      <JobProgress job={job} payment={payment} t={t} locale={locale} />
    </li>
  );
}

async function MyJobsContent({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/my-jobs">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const jobs = await listMyJobs(context, locale);
  if (!jobs) {
    notFound();
  }
  const search = searchSchema.parse(await searchParams);
  const shown = jobs[search.tab];
  // Payment details (with the QR) for finished jobs on this tab.
  const payments = new Map(
    await Promise.all(
      shown
        .filter((job) => job.status === "completed" || job.status === "verified")
        .map(
          async (job) =>
            [job.bookingId, await getJobPayment(context.supabase, job.bookingId)] as const
        )
    )
  );
  const empty: Record<PilotJobTab, string> = {
    today: t.jobs.noneToday,
    upcoming: t.jobs.noneUpcoming,
    completed: t.jobs.noneCompleted,
  };

  return (
    <>
      {search.error ? <StatusBanner kind="error" text={t.bookings.errors[search.error]} /> : null}
      {search.status === "paid" ? (
        <StatusBanner kind="success" text={t.payments.recorded} />
      ) : search.status ? (
        <StatusBanner kind="success" text={t.jobs[search.status]} />
      ) : null}
      <SegmentedTabs
        label={t.jobs.title}
        items={PILOT_JOB_TABS.map((tab) => ({
          href: withLocale(locale, `/dashboard/my-jobs?tab=${tab}`),
          label: t.jobs.tabs[tab],
          count: jobs[tab].length,
          active: tab === search.tab,
        }))}
      />
      {shown.length === 0 ? (
        <EmptyState
          icon={<ListChecksIcon weight="duotone" className="size-7" />}
          text={empty[search.tab]}
        />
      ) : (
        <ul className="space-y-4">
          {shown.map((job) => (
            <JobCard
              key={job.bookingId}
              job={job}
              payment={payments.get(job.bookingId) ?? null}
              t={t}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </>
  );
}

export default async function MyJobsPage({ searchParams }: PageProps<"/[lang]/dashboard/my-jobs">) {
  const { locale, t } = await getDictionary();

  return (
    <Page width="narrow">
      <PageHeader title={t.jobs.title} description={t.jobs.intro} />
      <Suspense fallback={<PageSkeleton />}>
        <MyJobsContent searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </Page>
  );
}
