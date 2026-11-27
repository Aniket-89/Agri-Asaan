import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PolygonIcon, GlobeHemisphereEastIcon } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import {
  BackLink,
  Badge,
  buttonClass,
  Page,
  PageHeader,
  Panel,
  SegmentedTabs,
  PageSkeleton,
} from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { GeoPolygon } from "@/lib/maps/geo";
import {
  ageInDays,
  cellsFor,
  getScanStatus,
  healthStatus,
  indexColor,
  INDEX_KINDS,
  listFieldHealth,
  loadPixelCells,
  STALE_AFTER_DAYS,
  type FieldHealth,
  type IndexKind,
  type Observation,
  type PixelCell,
} from "@/modules/crop-monitoring";
import {
  formatAge,
  formatIndex,
  formatPassDate,
  STATUS_TONES,
} from "@/modules/crop-monitoring/components/crop-health-card";
import { CropHealthMap } from "@/modules/crop-monitoring/components/crop-health-map";
import { IndexHeatmap, IndexLegend } from "@/modules/crop-monitoring/components/index-heatmap";
import { TrendLine } from "@/modules/crop-monitoring/components/trend-line";
import { canDrawBoundary, getField } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

const searchSchema = z.object({
  layer: z.enum(INDEX_KINDS).catch("ndvi"),
  status: z.enum(["boundarySaved", "boundaryRemoved"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.cropHealth.heading };
}

async function FieldHealthContent({
  params,
  searchParams,
  t,
  locale,
}: {
  params: PageProps<"/[lang]/dashboard/fields/[id]">["params"];
  searchParams: PageProps<"/[lang]/dashboard/fields/[id]">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const fieldId = z.uuid().safeParse((await params).id);
  if (!fieldId.success) {
    notFound();
  }
  // RLS decides who can read the field: the farmer, staff who manage them,
  // and pilots with a job on it.
  const [field, search] = await Promise.all([
    getField(context, fieldId.data, locale),
    searchParams.then((value) => searchSchema.parse(value)),
  ]);
  if (!field) {
    notFound();
  }

  const c = t.cropHealth;
  const health = field.boundary
    ? (await listFieldHealth(context, [field.id])).get(field.id)
    : undefined;
  const latest = health?.latestClear ?? null;
  const newest = health?.observations[0] ?? null;
  const [pixels, scanStatus] = await Promise.all([
    latest ? loadPixelCells(context, latest) : null,
    field.boundary && !latest ? getScanStatus(context, field.id) : null,
  ]);
  const layer = search.layer;
  const backHref =
    context.role === "farmer"
      ? withLocale(locale, "/dashboard")
      : withLocale(locale, `/dashboard/farmers/${field.farmerId}#fields`);
  const drawHref = withLocale(locale, `/dashboard/fields/${field.id}/boundary`);
  const now = new Date();
  const acres = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    maximumFractionDigits: 2,
  }).format(field.areaAcres);

  return (
    <>
      <BackLink href={backHref}>{c.back}</BackLink>
      <PageHeader
        title={format(c.title, { field: field.name })}
        description={`${field.cropName}, ${format(t.fields.acres, { area: acres })}`}
        action={
          field.boundary && canDrawBoundary(context.role) ? (
            <Link href={drawHref} className={buttonClass({ variant: "secondary", size: "sm" })}>
              <PolygonIcon weight="bold" className="size-4" aria-hidden />
              {c.editBoundary}
            </Link>
          ) : null
        }
      />
      {search.status === "boundarySaved" ? (
        <StatusBanner kind="success" text={t.boundary.saved} />
      ) : null}
      {search.status === "boundaryRemoved" ? (
        <StatusBanner kind="success" text={t.boundary.removed} />
      ) : null}

      {!field.boundary ? (
        <Panel>
          <div className="flex flex-col items-start gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-ink">
              <PolygonIcon weight="duotone" className="size-7" aria-hidden />
            </span>
            <h2 className="text-lg font-bold text-ink">{c.addBoundaryTitle}</h2>
            <p className="text-ink-muted">{format(c.addBoundaryText, { field: field.name })}</p>
            {canDrawBoundary(context.role) ? (
              <Link href={drawHref} className={buttonClass()}>
                <PolygonIcon weight="bold" className="size-5" aria-hidden />
                {c.addBoundary}
              </Link>
            ) : null}
          </div>
        </Panel>
      ) : !health || !latest ? (
        <Panel>
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-ink">
              <GlobeHemisphereEastIcon weight="duotone" className="size-6 text-brand" aria-hidden />
              {c.waiting}
            </p>
            {scanStatus ? (
              <p className="text-sm text-ink-muted">
                {format(c.lastChecked, {
                  time: formatCheckedTime(scanStatus.lastCheckedAt, locale),
                })}
                {scanStatus.lastError ? ` ${c.scanProblem}` : ""}
              </p>
            ) : null}
          </div>
        </Panel>
      ) : (
        <>
          <SegmentedTabs
            label={c.layer}
            items={INDEX_KINDS.map((kind) => ({
              href: withLocale(locale, `/dashboard/fields/${field.id}?layer=${kind}`),
              label: c.shortIndices[kind],
              active: kind === layer,
            }))}
          />

          <LayerPanel
            fieldName={field.name}
            boundary={field.boundary}
            pin={{ latitude: field.latitude, longitude: field.longitude }}
            layer={layer}
            health={health}
            latest={latest}
            pixels={pixels}
            newest={newest}
            now={now}
            locale={locale}
            t={t}
          />

          <Panel
            title={c.passes}
            icon={<GlobeHemisphereEastIcon weight="duotone" className="size-5" />}
          >
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 font-semibold">
                    {c.passDate}
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    {c.passQuality}
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    {c.shortIndices[layer]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {health.observations.map((observation) => {
                  const value = observation.values[layer];
                  return (
                    <tr key={observation.id} className="border-t border-field">
                      <td className="py-2 text-ink">
                        {formatPassDate(observation.observedAt, locale)}
                      </td>
                      <td className="py-2 text-ink-muted">
                        {c.quality[observation.quality]},{" "}
                        {format(c.cloud, { pct: String(Math.round(observation.cloudCoverPct)) })}
                      </td>
                      <td className="py-2 text-right font-semibold text-ink tabular-nums">
                        {value === null ? (
                          "–"
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: indexColor(layer, value) }}
                            />
                            {formatIndex(value, locale)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          <p className="text-sm text-ink-muted">{c.estimateNotice}</p>
        </>
      )}
    </>
  );
}

function formatCheckedTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function LayerPanel({
  fieldName,
  boundary,
  pin,
  layer,
  health,
  latest,
  pixels,
  newest,
  now,
  locale,
  t,
}: {
  fieldName: string;
  boundary: GeoPolygon;
  pin: { latitude: number; longitude: number };
  layer: IndexKind;
  health: FieldHealth;
  latest: Observation;
  pixels: PixelCell[] | null;
  newest: Observation | null;
  now: Date;
  locale: Locale;
  t: Dictionary;
}) {
  const c = t.cropHealth;
  const value = latest.values[layer] ?? 0;
  const status = healthStatus(layer, value);
  const cells = pixels ? cellsFor(layer, pixels) : [];
  const age = ageInDays(latest.observedAt, now);
  const mapLabel = format(c.mapLabel, { index: c.indices[layer], field: fieldName });

  return (
    <Panel>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-ink">{c.indices[layer]}</h2>
            <p className="text-sm text-ink-muted">{c.indexHints[layer]}</p>
          </div>
          <div className="text-right">
            <Badge tone={STATUS_TONES[status]}>{c.status[status]}</Badge>
            <p className="mt-1 text-sm text-ink-muted">
              {c.fieldAverage}{" "}
              <span className="text-lg font-bold text-ink tabular-nums">
                {formatIndex(value, locale)}
              </span>
            </p>
          </div>
        </div>

        {cells.length > 0 ? (
          <>
            <CropHealthMap
              boundary={boundary}
              cells={cells.map((cell) => ({
                ring: cell.ring,
                color: indexColor(layer, cell.value),
              }))}
              pin={pin}
              label={mapLabel}
              fallback={
                <IndexHeatmap
                  boundary={boundary}
                  cells={cells}
                  kind={layer}
                  label={mapLabel}
                  size={240}
                  clipId="field-heatmap"
                />
              }
            />
            <IndexLegend kind={layer} low={c.low} high={c.high} />
            <p className="text-xs text-ink-muted">
              {c.pixelNote}
              {cells.some((cell) => cell.value === null) ? ` ${c.cloudPixels}` : ""}
            </p>
          </>
        ) : (
          <p className="rounded-xl bg-field px-3 py-2 text-sm text-ink-muted">
            {c.pixelsUnavailable}
          </p>
        )}

        <dl className="grid gap-x-4 gap-y-1 text-sm text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="sr-only">{c.passDate}</dt>
            <dd>
              {format(c.observed, { date: formatPassDate(latest.observedAt, locale) })},{" "}
              {formatAge(age, c)}
            </dd>
          </div>
          <div>
            <dt className="sr-only">{c.passQuality}</dt>
            <dd>
              {c.quality[latest.quality]},{" "}
              {format(c.cloud, { pct: String(Math.round(latest.cloudCoverPct)) })}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dd>
              {format(c.source, { source: c.sources[latest.source] })} ({latest.processingVersion})
            </dd>
          </div>
        </dl>
        {newest && newest.id !== latest.id ? (
          <p className="rounded-xl bg-field px-3 py-2 text-sm text-ink">
            {format(c.latestCloudy, {
              date: formatPassDate(newest.observedAt, locale),
              clearDate: formatPassDate(latest.observedAt, locale),
            })}
          </p>
        ) : null}
        {age > STALE_AFTER_DAYS ? (
          <p className="rounded-xl bg-sun-soft px-3 py-2 text-sm text-sun-ink">
            {format(c.stale, { days: String(age) })}
          </p>
        ) : null}

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">
            {format(c.trend, { count: String(health.observations.length) })}
          </h3>
          <TrendLine
            kind={layer}
            values={[...health.observations]
              .reverse()
              .map((observation) => observation.values[layer])}
            label={format(c.trend, { count: String(health.observations.length) })}
            height={72}
          />
        </div>
      </div>
    </Panel>
  );
}

export default async function FieldHealthPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/fields/[id]">) {
  const { locale, t } = await getDictionary();
  return (
    <Page>
      <Suspense fallback={<PageSkeleton />}>
        <FieldHealthContent params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </Page>
  );
}
