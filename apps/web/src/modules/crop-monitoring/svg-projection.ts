import type { LngLat } from "@/lib/maps/boundary";
import type { GeoPolygon } from "@/lib/maps/geo";

// Projects a field into an SVG box of `width` x `height` (with `padding`),
// keeping its shape: longitude is scaled by cos(latitude) and the larger
// side fills the box. SVG y grows downwards, so latitude is flipped.
export function svgProjector(
  polygon: GeoPolygon,
  width: number,
  height: number,
  padding = 4
): (point: LngLat) => [number, number] {
  const ring = polygon.coordinates[0];
  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const west = Math.min(...lngs);
  const north = Math.max(...lats);
  const shrink = Math.cos((((Math.min(...lats) + north) / 2) * Math.PI) / 180);
  const spanX = (Math.max(...lngs) - west) * shrink || 1e-9;
  const spanY = north - Math.min(...lats) || 1e-9;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return ([lng, lat]) => [
    Number((offsetX + (lng - west) * shrink * scale).toFixed(2)),
    Number((offsetY + (north - lat) * scale).toFixed(2)),
  ];
}

export function svgPath(points: readonly LngLat[], project: (point: LngLat) => [number, number]) {
  return `${points
    .map((point, index) => {
      const [x, y] = project(point);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ")} Z`;
}
