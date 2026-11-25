import { z } from "zod";

// Hosted OpenStreetMap vector tiles (ADR 0016). NEXT_PUBLIC_ so the browser
// bundle can read it; override to point at a self-hosted style later.
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

// Whole-of-India view used when there is nothing to centre on yet.
export const INDIA_VIEW = { longitude: 79, latitude: 22.5, zoom: 4 } as const;

export type GeoPolygon = { type: "Polygon"; coordinates: [number, number][][] };

export type PinTone = "neutral" | "open" | "done";

// One field on a map. Popup text is plain text (never HTML).
export type MapPin = {
  id: string;
  label: string;
  detail?: string;
  latitude: number;
  longitude: number;
  boundary?: GeoPolygon | null;
  tone?: PinTone;
};

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(position).min(4)).min(1),
});

// Boundaries arrive from the database as untyped JSON; anything that is not
// a well-formed GeoJSON Polygon is dropped rather than drawn.
export function toPolygon(value: unknown): GeoPolygon | null {
  const parsed = polygonSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type Bounds = [[number, number], [number, number]];

// [[west, south], [east, north]] around every pin and boundary vertex, or
// null when there are no pins.
export function pinBounds(pins: readonly MapPin[]): Bounds | null {
  if (pins.length === 0) {
    return null;
  }
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const include = (longitude: number, latitude: number) => {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  };
  for (const pin of pins) {
    include(pin.longitude, pin.latitude);
    for (const ring of pin.boundary?.coordinates ?? []) {
      for (const [longitude, latitude] of ring) {
        include(longitude, latitude);
      }
    }
  }
  return [
    [west, south],
    [east, north],
  ];
}

// Parses a coordinate typed into a form input; null when empty or invalid.
export function parseCoordinate(value: string, limit: 90 | 180): number | null {
  if (value.trim() === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}
