import type { GeoPolygon } from "./geo";

// [longitude, latitude], the GeoJSON order.
export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_378_137;
const SQUARE_METRES_PER_ACRE = 4046.8564224;

// The same limits the database enforces (crop_monitoring migration), so the
// drawing screen can explain a problem before saving.
export const BOUNDARY_LIMITS = {
  minCorners: 3,
  maxCorners: 100,
  minAcres: 0.05,
  maxAcres: 1000,
  maxPinDistanceM: 500,
} as const;

export type BoundaryProblem =
  "tooFewCorners" | "tooManyCorners" | "crosses" | "tooSmall" | "tooLarge" | "tooFar";

const radians = (degrees: number) => (degrees * Math.PI) / 180;

// Area of a ring of corners on the WGS84 sphere (the spherical-excess
// approximation PostGIS-free tools use), in acres. Works for open or closed
// rings.
export function ringAreaAcres(corners: readonly LngLat[]): number {
  const ring = openRing(corners);
  if (ring.length < 3) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < ring.length; index++) {
    const [lng1, lat1] = ring[index];
    const [lng2, lat2] = ring[(index + 1) % ring.length];
    total += radians(lng2 - lng1) * (2 + Math.sin(radians(lat1)) + Math.sin(radians(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2) / SQUARE_METRES_PER_ACRE;
}

// Great-circle distance in metres.
export function distanceMetres([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function openRing(corners: readonly LngLat[]): LngLat[] {
  const first = corners[0];
  const last = corners[corners.length - 1];
  return corners.length > 1 && first[0] === last[0] && first[1] === last[1]
    ? corners.slice(0, -1)
    : [...corners];
}

function orientation(a: LngLat, b: LngLat, c: LngLat): number {
  return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
}

function segmentsCross(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  return (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  );
}

// True when any two non-neighbouring edges of the closed ring cross.
export function ringCrossesItself(corners: readonly LngLat[]): boolean {
  const ring = openRing(corners);
  const count = ring.length;
  for (let i = 0; i < count; i++) {
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) {
        continue; // first and last edges share a corner
      }
      if (segmentsCross(ring[i], ring[(i + 1) % count], ring[j], ring[(j + 1) % count])) {
        return true;
      }
    }
  }
  return false;
}

export function pointInRing([x, y]: LngLat, corners: readonly LngLat[]): boolean {
  const ring = openRing(corners);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Nearest distance from the pin to the ring (zero when inside), in metres,
// using the nearest corner or edge midpoint; close enough for a 500 m check
// on field-sized shapes.
function pinDistanceMetres(pin: LngLat, ring: readonly LngLat[]): number {
  if (pointInRing(pin, ring)) {
    return 0;
  }
  let nearest = Infinity;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      nearest = Math.min(
        nearest,
        distanceMetres(pin, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      );
    }
  }
  return nearest;
}

// The first problem with a drawn boundary, or null when it can be saved.
export function boundaryProblem(corners: readonly LngLat[], pin: LngLat): BoundaryProblem | null {
  const ring = openRing(corners);
  if (ring.length < BOUNDARY_LIMITS.minCorners) {
    return "tooFewCorners";
  }
  if (ring.length > BOUNDARY_LIMITS.maxCorners) {
    return "tooManyCorners";
  }
  if (ringCrossesItself(ring)) {
    return "crosses";
  }
  const acres = ringAreaAcres(ring);
  if (acres < BOUNDARY_LIMITS.minAcres) {
    return "tooSmall";
  }
  if (acres > BOUNDARY_LIMITS.maxAcres) {
    return "tooLarge";
  }
  if (pinDistanceMetres(pin, ring) > BOUNDARY_LIMITS.maxPinDistanceM) {
    return "tooFar";
  }
  return null;
}

// Closed GeoJSON Polygon from the drawn corners, rounded to ~10 cm.
export function cornersToPolygon(corners: readonly LngLat[]): GeoPolygon {
  const ring = openRing(corners).map(
    ([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))] as LngLat
  );
  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}
