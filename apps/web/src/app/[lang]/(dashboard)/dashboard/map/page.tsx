import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { FieldMap } from "@/components/maps/field-map";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { bookingDateWindow } from "@/modules/bookings";
import { formatAcres } from "@/modules/bookings/components/booking-ui";
import { listMapRegions, listRegionMapPins } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

const searchSchema = z.object({
  region: z.uuid().optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.maps.overviewTitle };
}

const LEGEND = [
  { tone: "open", color: "bg-amber-700", key: "legendOpen" },
  { tone: "done", color: "bg-green-700", key: "legendDone" },
  { tone: "neutral", color: "bg-blue-700", key: "legendNone" },
] as const;

async function FieldMapContent({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/map">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const regions = await listMapRegions(context);
  if (!regions) {
    notFound();
  }
  if (regions.length === 0) {
    return <p>{t.maps.noRegions}</p>;
  }
  const search = searchSchema.parse(await searchParams);
  // Only regions the caller manages can be chosen; anything else falls back.
  const region = regions.find((option) => option.id === search.region) ?? regions[0];
  const { pins, truncated } = await listRegionMapPins(
    context,
    region.id,
    bookingDateWindow(new Date()).min
  );

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="grow">
          <span className="mb-1 block text-sm">{t.maps.region}</span>
          <select
            name="region"
            defaultValue={region.id}
            className="min-h-11 w-full rounded border px-3 py-2"
          >
            {regions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded bg-black px-4 py-2 text-white">
          {t.maps.show}
        </button>
      </form>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t.maps.overviewTitle}>
        {LEGEND.map((item) => (
          <li key={item.tone} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block size-3 rounded-full ${item.color}`} />
            {t.maps[item.key]}
          </li>
        ))}
      </ul>

      {pins.length === 0 ? <p>{t.maps.noFields}</p> : null}
      {truncated ? (
        <p className="text-sm text-amber-800">{format(t.maps.tooMany, { count: pins.length })}</p>
      ) : null}
      <FieldMap
        heightClass="h-[28rem]"
        label={format(t.maps.overviewMap, { region: region.name })}
        labels={{ loading: t.maps.loading, failed: t.maps.failed }}
        pins={pins.map((pin) => ({
          ...pin,
          detail: format(t.maps.fieldDetail, {
            farmer: pin.farmerName,
            village: pin.villageName,
            area: formatAcres(pin.areaAcres, locale, t.bookings),
          }),
        }))}
      />
    </>
  );
}

export default async function FieldMapPage({ searchParams }: PageProps<"/[lang]/dashboard/map">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.maps.backToDashboard}
        </a>
        <h1 className="text-2xl font-semibold">{t.maps.overviewTitle}</h1>
        <p className="text-gray-600">{t.maps.overviewIntro}</p>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <FieldMapContent searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </main>
  );
}
