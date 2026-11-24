import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { listMyJobs } from "@/modules/bookings";
import {
  BookingStatusBadge,
  formatAcres,
  formatBookingDate,
} from "@/modules/bookings/components/booking-ui";
import { getActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.jobs.title };
}

// OpenStreetMap link for a field pin (no paid map provider in the MVP).
const mapHref = (latitude: number, longitude: number) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

async function MyJobsContent({ t, locale }: { t: Dictionary; locale: Locale }) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const jobs = await listMyJobs(context, locale);
  if (!jobs) {
    notFound();
  }

  if (jobs.length === 0) {
    return <p>{t.jobs.none}</p>;
  }

  return (
    <ul className="space-y-4">
      {jobs.map((job) => (
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
        </li>
      ))}
    </ul>
  );
}

export default async function MyJobsPage() {
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
        <MyJobsContent t={t} locale={locale} />
      </Suspense>
    </main>
  );
}
