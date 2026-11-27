import { ringAreaAcres, type LngLat } from "@/lib/maps/boundary";
import type { GeoPolygon } from "@/lib/maps/geo";

import { INDEX_SCALES, type IndexKind } from "./indices";

export type GridCell = { ring: LngLat[]; value: number };

// Deterministic 32-bit hash (FNV-1a) of a string, for repeatable patterns.
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// The part of `ring` inside an axis-aligned rectangle (Sutherland-Hodgman:
// the rectangle is convex, so any field shape can be clipped against it).
// Returns a closed ring, or [] when they do not overlap.
export function clipRingToRect(
  ring: readonly LngLat[],
  west: number,
  south: number,
  east: number,
  north: number
): LngLat[] {
  type Edge = { inside: (point: LngLat) => boolean; cross: (a: LngLat, b: LngLat) => LngLat };
  const atX = (a: LngLat, b: LngLat, x: number): LngLat => [
    x,
    a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]),
  ];
  const atY = (a: LngLat, b: LngLat, y: number): LngLat => [
    a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]),
    y,
  ];
  const edges: Edge[] = [
    { inside: (p) => p[0] >= west, cross: (a, b) => atX(a, b, west) },
    { inside: (p) => p[0] <= east, cross: (a, b) => atX(a, b, east) },
    { inside: (p) => p[1] >= south, cross: (a, b) => atY(a, b, south) },
    { inside: (p) => p[1] <= north, cross: (a, b) => atY(a, b, north) },
  ];
  let output: LngLat[] = ring.slice(0, -1);
  for (const edge of edges) {
    const input = output;
    output = [];
    input.forEach((current, index) => {
      const previous = input[(index + input.length - 1) % input.length];
      if (edge.inside(current)) {
        if (!edge.inside(previous)) {
          output.push(edge.cross(previous, current));
        }
        output.push(current);
      } else if (edge.inside(previous)) {
        output.push(edge.cross(previous, current));
      }
    });
    if (output.length === 0) {
      return [];
    }
  }
  return output.length < 3 ? [] : [...output, output[0]];
}

// Simulated per-pixel index values across a field, for the demo heatmap
// (ADR 0025). Real data will come as rasters from the satellite worker. The
// pattern is smooth waves plus one weaker patch, placed by `seed`, then
// shifted so the cells average exactly to the observation's field mean.
// Cells are squares on a grid `cellsAcross` wide, clipped to the boundary.
export function simulatedIndexGrid(
  polygon: GeoPolygon,
  kind: IndexKind,
  mean: number,
  seed: number,
  cellsAcross = 14
): GridCell[] {
  const ring = polygon.coordinates[0];
  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  // Square cells on the ground: a degree of longitude shrinks with latitude.
  const shrink = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const size = Math.max((east - west) * shrink, north - south) / cellsAcross;
  const lngSize = size / shrink;

  const phase = (offset: number) => ((seed >>> offset) % 628) / 100;
  const patch: LngLat = [
    west + ((seed % 97) / 97) * (east - west),
    south + (((seed >>> 8) % 89) / 89) * (north - south),
  ];
  const spread = INDEX_SCALES[kind].max - INDEX_SCALES[kind].min;

  const cells: GridCell[] = [];
  for (let lat = south; lat < north; lat += size) {
    for (let lng = west; lng < east; lng += lngSize) {
      const centre: LngLat = [lng + lngSize / 2, lat + size / 2];
      const clipped = clipRingToRect(ring, lng, lat, lng + lngSize, lat + size);
      if (clipped.length === 0 || ringAreaAcres(clipped) < 1e-6) {
        continue;
      }
      const x = (centre[0] - west) / (east - west || 1);
      const y = (centre[1] - south) / (north - south || 1);
      const distance = Math.hypot(
        (centre[0] - patch[0]) / (east - west || 1),
        (centre[1] - patch[1]) / (north - south || 1)
      );
      const variation =
        0.05 * Math.sin(x * 5 + phase(0)) +
        0.04 * Math.cos(y * 6 + phase(4)) -
        0.16 * Math.exp(-(distance * distance) / 0.03);
      cells.push({
        ring: clipped,
        value: variation * spread,
      });
    }
  }

  if (cells.length === 0) {
    return [];
  }
  const average = cells.reduce((sum, cell) => sum + cell.value, 0) / cells.length;
  return cells.map((cell) => ({
    ring: cell.ring,
    value: Math.min(1, Math.max(-1, Number((cell.value - average + mean).toFixed(3)))),
  }));
}
