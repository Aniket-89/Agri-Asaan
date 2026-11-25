import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { FieldMap } from "@/components/maps/field-map";
import { StatusBanner } from "@/components/shared/status-banner";
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
  formatAcres,
  formatBookingDate,
  formatSprayed,
} from "@/modules/bookings/components/booking-ui";
import { getActiveMembershipContext } from "@/modules/organizations";

import { completeJobAction, startJobAction } from "./actions";

export const instant = false;

const searchSchema = z.object({
  tab: z.enum(PILOT_JOB_TABS).catch("today"),
  status: z.enum(["started", "completed"]).optional().catch(undefined),
  error: z.enum(BOOKING_ERROR_CODES).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.jobs.title };
}

// OpenStreetMap link for a field pin (no paid map provider in the MVP).
const mapHref = (latitude: number, longitude: number) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

function JobProgress({ job, t, locale }: { job: PilotJob; t: Dictionary; locale: Locale }) {
  if (job.status === "completed" || job.status === "verified") {
    return (
      <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
        {job.fields.map((field) => (
          <p key={field.fieldId}>
            {field.fieldName} ·{" "}
            {formatSprayed(field.actualAcres ?? 0, field.areaAcres, locale, t.bookings)}
          </p>
        ))}
        {job.actualTotalAcres !== null ? (
          <p className="font-semibold">
            {formatSprayed(
              job.actualTotalAcres,
              job.totalAcres,
              locale,
              t.bookings,
              "totalSprayed"
            )}
          </p>
        ) : null}
        {job.status === "completed" ? (
          <p className="text-gray-600">{t.jobs.awaitingVerification}</p>
        ) : null}
      </div>
    );
  }
  if (job.status === "assigned") {
    return job.canStart ? (
      <form action={startJobAction}>
        <input type="hidden" name="bookingId" value={job.bookingId} />
        <button type="submit" className="min-h-11 w-full rounded bg-black px-4 py-3 text-white">
          {t.jobs.start}
        </button>
      </form>
    ) : (
      <p className="text-sm text-gray-600">{t.jobs.startOnDay}</p>
    );
  }

  return (
    <form action={completeJobAction} className="space-y-3 rounded-lg bg-gray-50 p-3">
      <h2 className="font-semibold">{t.jobs.finishHeading}</h2>
      {job.sentBackReason ? (
        <StatusBanner kind="error" text={format(t.jobs.sentBack, { reason: job.sentBackReason })} />
      ) : null}
      <input type="hidden" name="bookingId" value={job.bookingId} />
      {job.fields.map((field) => (
        <label key={field.fieldId} className="block">
          <input type="hidden" name="fieldIds" value={field.fieldId} />
          <span className="mb-1 block text-sm">
            {field.fieldName} ·{" "}
            {format(t.jobs.acresSprayed, {
              area: formatAcres(field.areaAcres, locale, t.bookings),
            })}
          </span>
          <input
            name="acres"
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={field.areaAcres * 2}
            step="0.01"
            defaultValue={field.actualAcres ?? field.areaAcres}
            className="min-h-11 w-full rounded border bg-white px-3 py-2"
          />
        </label>
      ))}
      <label className="block">
        <span className="mb-1 block text-sm">{t.jobs.notes}</span>
        <textarea
          name="notes"
          maxLength={500}
          rows={2}
          className="w-full rounded border bg-white px-3 py-2"
        />
      </label>
      <button type="submit" className="min-h-11 w-full rounded bg-black px-4 py-3 text-white">
        {t.jobs.complete}
      </button>
    </form>
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
  const empty: Record<PilotJobTab, string> = {
    today: t.jobs.noneToday,
    upcoming: t.jobs.noneUpcoming,
    completed: t.jobs.noneCompleted,
  };

  return (
    <>
      {search.error ? <StatusBanner kind="error" text={t.bookings.errors[search.error]} /> : null}
      {search.status ? <StatusBanner kind="success" text={t.jobs[search.status]} /> : null}
      <nav aria-label={t.jobs.title} className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
        {PILOT_JOB_TABS.map((tab) => {
          const active = tab === search.tab;
          return (
            <a
              key={tab}
              href={withLocale(locale, `/dashboard/my-jobs?tab=${tab}`)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-md px-2 text-center text-sm ${
                active ? "bg-white font-semibold shadow-sm" : "text-gray-700"
              }`}
            >
              {t.jobs.tabs[tab]} ({jobs[tab].length})
            </a>
          );
        })}
      </nav>
      {shown.length === 0 ? <p>{empty[search.tab]}</p> : null}
      <ul className="space-y-4">
        {shown.map((job) => (
          <li key={job.bookingId} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{formatBookingDate(job.date, locale)}</p>
                <p className="text-sm">{job.slotLabel}</p>
              </div>
              <BookingStatusBadge status={job.status} t={t.bookings} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-600">{t.bookings.farmer}</dt>
              <dd>{job.farmerName}</dd>
              <dt className="text-gray-600">{t.bookings.village}</dt>
              <dd>{job.villageName}</dd>
              <dt className="text-gray-600">{t.bookings.drone}</dt>
              <dd>{format(t.jobs.drone, { uid: job.droneUid })}</dd>
            </dl>
            <a
              className="inline-block min-h-11 rounded border px-4 py-2 text-sm"
              href={`tel:+91${job.farmerPhone}`}
            >
              {format(t.jobs.call, { name: job.farmerName })}
            </a>
            {job.notes ? <p className="rounded bg-gray-50 p-3 text-sm">{job.notes}</p> : null}
            <div className="space-y-2">
              <h2 className="font-semibold">
                {t.jobs.fields} · {formatAcres(job.totalAcres, locale, t.bookings)}
              </h2>
              {/* Collapsed so a list of jobs doesn't load many maps at once. */}
              <details className="rounded border">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
                  {t.maps.showMap}
                </summary>
                <div className="p-2">
                  <FieldMap
                    label={t.maps.jobFields}
                    labels={{ loading: t.maps.loading, failed: t.maps.failed }}
                    pins={job.fields.map((field) => ({
                      id: field.fieldId,
                      label: field.fieldName,
                      detail: `${field.cropName} · ${formatAcres(field.areaAcres, locale, t.bookings)}`,
                      latitude: field.latitude,
                      longitude: field.longitude,
                    }))}
                  />
                </div>
              </details>
              <ul className="space-y-2">
                {job.fields.map((field) => (
                  <li key={field.fieldId} className="rounded border p-3 text-sm">
                    <p className="font-medium">{field.fieldName}</p>
                    <p>
                      {field.cropName} · {formatAcres(field.areaAcres, locale, t.bookings)}
                    </p>
                    <a
                      className="inline-block min-h-11 py-2 underline"
                      href={mapHref(field.latitude, field.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.jobs.openMap}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <JobProgress job={job} t={t} locale={locale} />
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function MyJobsPage({ searchParams }: PageProps<"/[lang]/dashboard/my-jobs">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.jobs.backToDashboard}
        </a>
        <h1 className="text-2xl font-semibold">{t.jobs.title}</h1>
        <p className="text-gray-600">{t.jobs.intro}</p>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <MyJobsContent searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </main>
  );
}
