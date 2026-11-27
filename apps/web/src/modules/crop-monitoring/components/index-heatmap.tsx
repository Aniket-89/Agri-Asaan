import type { GeoPolygon } from "@/lib/maps/geo";

import type { GridCell } from "../pixel-file";
import { INDEX_SCALES, indexColor, type IndexKind } from "../indices";
import { svgPath, svgProjector } from "../svg-projection";

// The field's index map drawn as SVG: no map library or tiles, so it renders
// on the server and shows instantly on any phone. Cells are clipped to the
// boundary.
export function IndexHeatmap({
  boundary,
  cells,
  kind,
  label,
  size = 160,
  clipId,
}: {
  boundary: GeoPolygon;
  cells: GridCell[];
  kind: IndexKind;
  label: string;
  size?: number;
  // Unique per page, for the clip path.
  clipId: string;
}) {
  const project = svgProjector(boundary, size, size, 6);
  const outline = svgPath(boundary.coordinates[0], project);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>
      </defs>
      <path d={outline} fill="var(--color-field)" />
      <g clipPath={`url(#${clipId})`}>
        {cells.map((cell, index) => (
          <path
            key={index}
            d={svgPath(cell.ring.slice(0, -1), project)}
            fill={indexColor(kind, cell.value)}
            stroke={indexColor(kind, cell.value)}
            strokeWidth={0.6}
          />
        ))}
      </g>
      <path
        d={outline}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Colour ramp with its low/high ends, under a map.
export function IndexLegend({ kind, low, high }: { kind: IndexKind; low: string; high: string }) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="space-y-1" aria-hidden="true">
      <div
        className="h-2.5 rounded-full"
        style={{
          backgroundImage: `linear-gradient(90deg, ${stops
            .map((stop) => indexColorAt(kind, stop))
            .join(", ")})`,
        }}
      />
      <div className="flex justify-between text-xs text-ink-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function indexColorAt(kind: IndexKind, position: number): string {
  const { min, max } = INDEX_SCALES[kind];
  return indexColor(kind, min + (max - min) * position);
}
