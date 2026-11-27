import Link from "next/link";
import { PolygonIcon, GlobeHemisphereEastIcon } from "@phosphor-icons/react/dist/ssr";

import { Badge, buttonClass, type BadgeTone } from "@/components/ui";
import { format, type Dictionary, type Locale } from "@/lib/i18n";
import type { GeoPolygon } from "@/lib/maps/geo";

import type { FieldHealth, Observation } from "../crop-health.service";
import { hashSeed, simulatedIndexGrid } from "../index-grid";
import { ageInDays, healthStatus, type HealthStatus, type IndexKind } from "../indices";
import { IndexHeatmap } from "./index-heatmap";
import { TrendLine } from "./trend-line";

type Labels = Dictionary["cropHealth"];

export const STATUS_TONES: Record<HealthStatus, BadgeTone> = {
  good: "leaf",
  watch: "sun",
  stressed: "clay",
};

export function formatPassDate(observedAt: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(observedAt));
}

export function formatAge(days: number, t: Labels): string {
  if (days === 0) {
    return t.ageToday;
  }
  return days === 1 ? t.ageOne : format(t.ageMany, { days: String(days) });
}

export function formatIndex(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// The pattern of one pass's index map is fixed by the pass and index.
export function passGrid(boundary: GeoPolygon, observation: Observation, kind: IndexKind) {
  const mean = observation.values[kind];
  return mean === null
    ? []
    : simulatedIndexGrid(boundary, kind, mean, hashSeed(`${observation.id}:${kind}`));
}

type CardField = { id: string; name: string; cropName: string; boundary: GeoPolygon | null };

// One field on the farmer dashboard: its crop health at a glance, or an
// invitation to draw the boundary that crop monitoring needs.
export function CropHealthCard({
  field,
  health,
  viewHref,
  drawHref,
  now,
  locale,
  t,
}: {
  field: CardField;
  health: FieldHealth | undefined;
  viewHref: string;
  drawHref: string;
  now: Date;
  locale: Locale;
  t: Labels;
}) {
  if (!field.boundary) {
    return (
      <article className="flex h-full flex-col gap-3 rounded-2xl border-2 border-dashed border-leaf/60 bg-surface/60 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-ink"
          >
            <PolygonIcon weight="duotone" className="size-6" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-ink">{field.name}</h3>
            <p className="text-sm text-ink-muted">{field.cropName}</p>
          </div>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-ink">{t.addBoundaryTitle}</p>
          <p className="text-sm text-ink-muted">
            {format(t.addBoundaryText, { field: field.name })}
          </p>
        </div>
        <Link
          href={drawHref}
          className={`${buttonClass({ variant: "secondary", size: "sm" })} mt-auto self-start`}
        >
          <PolygonIcon weight="bold" className="size-4" aria-hidden />
          {t.addBoundary}
        </Link>
      </article>
    );
  }

  const latest = health?.latestClear ?? null;
  const ndvi = latest?.values.ndvi ?? null;

  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl bg-surface p-4 shadow-soft">
      <div className="flex gap-3">
        <div className="w-24 shrink-0 sm:w-28">
          {latest ? (
            <IndexHeatmap
              boundary={field.boundary}
              cells={passGrid(field.boundary, latest, "ndvi")}
              kind="ndvi"
              label={format(t.mapLabel, { index: t.indices.ndvi, field: field.name })}
              size={112}
              clipId={`card-${field.id}`}
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-field text-ink-faint">
              <GlobeHemisphereEastIcon weight="duotone" className="size-8" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="leading-tight font-bold text-ink">{field.name}</h3>
          <p className="text-sm text-ink-muted">{field.cropName}</p>
          {latest && ndvi !== null ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONES[healthStatus("ndvi", ndvi)]}>
                  {t.status[healthStatus("ndvi", ndvi)]}
                </Badge>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {t.shortIndices.ndvi} {formatIndex(ndvi, locale)}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                {format(t.observed, { date: formatPassDate(latest.observedAt, locale) })},{" "}
                {formatAge(ageInDays(latest.observedAt, now), t)}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t.waiting}</p>
          )}
        </div>
      </div>
      {health && health.observations.length > 1 ? (
        <TrendLine
          kind="ndvi"
          values={[...health.observations].reverse().map((observation) => observation.values.ndvi)}
          label={format(t.trend, { count: String(health.observations.length) })}
          height={44}
        />
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {latest?.source === "simulated-demo" ? (
          <Badge tone="neutral">{t.demoBadge}</Badge>
        ) : (
          <span />
        )}
        <Link href={viewHref} className={buttonClass({ variant: "quiet", size: "sm" })}>
          {t.view}
        </Link>
      </div>
    </article>
  );
}
