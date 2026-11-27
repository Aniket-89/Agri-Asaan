import { z } from "zod";

import type { LngLat } from "@/lib/maps/boundary";

import type { IndexKind } from "./indices";

// One 10 m Sentinel-2 pixel, clipped to the field boundary and converted to
// longitude/latitude by the satellite worker (ADR 0026). Values are null
// where the pixel was hidden by cloud, shadow or missing data.
const indexValue = z.number().min(-1).max(1).nullable();
const cellSchema = z.object({
  ring: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(4)
    .max(64),
  ndvi: indexValue,
  ndre: indexValue,
  ndmi: indexValue,
});
const pixelFileSchema = z.object({
  version: z.literal(1),
  observedAt: z.string(),
  cells: z.array(cellSchema).max(50_000),
});

export type PixelCell = z.infer<typeof cellSchema>;

// A cell to draw for one index; null value = hidden by cloud.
export type GridCell = { ring: LngLat[]; value: number | null };

// The worker's file, or null when it is not a well-formed pixel file.
export function parsePixelFile(value: unknown): PixelCell[] | null {
  const parsed = pixelFileSchema.safeParse(value);
  return parsed.success ? parsed.data.cells : null;
}

export function cellsFor(kind: IndexKind, cells: readonly PixelCell[]): GridCell[] {
  return cells.map((cell) => ({ ring: cell.ring, value: cell[kind] }));
}
