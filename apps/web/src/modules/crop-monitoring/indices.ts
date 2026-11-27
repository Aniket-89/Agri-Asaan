// Vegetation indices shown for a field (ADR 0025). Pure functions only.

export const INDEX_KINDS = ["ndvi", "ndre", "ndmi"] as const;
export type IndexKind = (typeof INDEX_KINDS)[number];

export type HealthStatus = "good" | "watch" | "stressed";

type Scale = {
  // Values at or above `good` read as healthy, below `watch` as stressed.
  good: number;
  watch: number;
  // Colour ramp from low to high across [min, max].
  min: number;
  max: number;
  colors: readonly string[];
};

// Thresholds are rough, crop-agnostic guides for a demo: real advice depends
// on crop, growth stage and season, which is why every screen calls them
// estimates.
export const INDEX_SCALES: Record<IndexKind, Scale> = {
  // Vegetation vigour (red and near-infrared bands).
  ndvi: {
    good: 0.6,
    watch: 0.4,
    min: 0.1,
    max: 0.9,
    colors: ["#a50026", "#f46d43", "#fee08b", "#a6d96a", "#1a9850"],
  },
  // Chlorophyll / nitrogen (red-edge band); sits lower than NDVI.
  ndre: {
    good: 0.37,
    watch: 0.25,
    min: 0.05,
    max: 0.6,
    colors: ["#c51b7d", "#e9a3c9", "#fde0ef", "#a1d76a", "#4d9221"],
  },
  // Leaf water content (near-infrared and short-wave infrared bands).
  ndmi: {
    good: 0.25,
    watch: 0.1,
    min: -0.2,
    max: 0.5,
    colors: ["#8c510a", "#d8b365", "#f6e8c3", "#5ab4ac", "#01665e"],
  },
};

// Pixels hidden by cloud, shadow or missing data.
export const CLOUD_COLOR = "#cfd6d1";

export function healthStatus(kind: IndexKind, value: number): HealthStatus {
  const scale = INDEX_SCALES[kind];
  if (value >= scale.good) {
    return "good";
  }
  return value >= scale.watch ? "watch" : "stressed";
}

function hexToRgb(hex: string): [number, number, number] {
  const number = Number.parseInt(hex.slice(1), 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

// Colour for a value on the index's ramp, linearly blended between stops;
// grey for a pixel with no value.
export function indexColor(kind: IndexKind, value: number | null): string {
  if (value === null) {
    return CLOUD_COLOR;
  }
  const { min, max, colors } = INDEX_SCALES[kind];
  const position = Math.min(1, Math.max(0, (value - min) / (max - min))) * (colors.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(colors.length - 1, lower + 1);
  const t = position - lower;
  const [r1, g1, b1] = hexToRgb(colors[lower]);
  const [r2, g2, b2] = hexToRgb(colors[upper]);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

// Whole days between an observation and now, never negative.
export function ageInDays(observedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(observedAt).getTime()) / 86_400_000));
}

// Sentinel-2 revisits every ~5 days; older than two missed passes is stale.
export const STALE_AFTER_DAYS = 12;
