import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { MapTrifoldIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { FieldMap } from "@/components/maps/field-map";
import { Button, controlClass, EmptyState, Page, PageHeader } from "@/components/ui";
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
  { tone: "open", color: "bg-[#c47d06]", key: "legendOpen" },
  { tone: "done", color: "bg-[#2e7d32]", key: "legendDone" },
  { tone: "neutral", color: "bg-[#2a679e]", key: "legendNone" },
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
    return (
      <EmptyState
        icon={<MapTrifoldIcon weight="duotone" className="size-7" />}
        text={t.maps.noRegions}
      />
    );
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
      <div className="space-y-3 rounded-2xl bg-surface p-3 shadow-soft sm:p-4">
        <form method="get" className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t.maps.region}</span>
            <select name="region" defaultValue={region.id} className={controlClass}>
              {regions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" className="shrink-0">
            {t.maps.show}
          </Button>
        </form>

        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-sm text-ink-muted"
          aria-label={t.maps.overviewTitle}
        >
          {LEGEND.map((item) => (
            <li key={item.tone} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`inline-block size-3 rounded-full ${item.color}`}
              />
              {t.maps[item.key]}
            </li>
          ))}
        </ul>

        {pins.length === 0 ? <p className="px-1 text-ink-muted">{t.maps.noFields}</p> : null}
        {truncated ? (
          <p className="flex items-center gap-2 rounded-xl bg-sun-soft px-3 py-2 text-sm text-sun-ink">
            <WarningIcon weight="fill" className="size-4 shrink-0" aria-hidden />
            {format(t.maps.tooMany, { count: pins.length })}
          </p>
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
      </div>
    </>
  );
}

export default async function FieldMapPage({ searchParams }: PageProps<"/[lang]/dashboard/map">) {
  const { locale, t } = await getDictionary();

  return (
    <Page width="wide">
      <PageHeader title={t.maps.overviewTitle} description={t.maps.overviewIntro} />
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <FieldMapContent searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </Page>
  );
}
