import { describe, expect, it } from "vitest";

import { ringAreaAcres, type LngLat } from "@/lib/maps/boundary";
import type { GeoPolygon } from "@/lib/maps/geo";

import { hashSeed, simulatedIndexGrid } from "./index-grid";
import { ageInDays, healthStatus, indexColor } from "./indices";
import { svgPath, svgProjector } from "./svg-projection";

const field: GeoPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [77.5995, 27.4995],
      [77.6005, 27.4995],
      [77.6005, 27.5005],
      [77.5995, 27.5005],
      [77.5995, 27.4995],
    ],
  ],
};

describe("healthStatus", () => {
  it("reads each index against its own thresholds", () => {
    expect(healthStatus("ndvi", 0.72)).toBe("good");
    expect(healthStatus("ndvi", 0.6)).toBe("good");
    expect(healthStatus("ndvi", 0.5)).toBe("watch");
    expect(healthStatus("ndvi", 0.3)).toBe("stressed");
    // The same value means more for the red-edge and moisture indices.
    expect(healthStatus("ndre", 0.4)).toBe("good");
    expect(healthStatus("ndmi", 0.15)).toBe("watch");
    expect(healthStatus("ndmi", 0.05)).toBe("stressed");
  });
});

describe("indexColor", () => {
  it("uses the ramp ends at and beyond the scale limits", () => {
    expect(indexColor("ndvi", 0.1)).toBe("#a50026");
    expect(indexColor("ndvi", -0.5)).toBe("#a50026");
    expect(indexColor("ndvi", 0.9)).toBe("#1a9850");
    expect(indexColor("ndvi", 1)).toBe("#1a9850");
  });

  it("blends between stops", () => {
    expect(indexColor("ndvi", 0.5)).toBe("#fee08b");
    expect(indexColor("ndvi", 0.45)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("ageInDays", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  it("counts whole days and never goes negative", () => {
    expect(ageInDays("2026-11-27T05:30:00Z", now)).toBe(0);
    expect(ageInDays("2026-11-22T05:30:00Z", now)).toBe(5);
    expect(ageInDays("2026-11-28T05:30:00Z", now)).toBe(0);
  });
});

describe("simulatedIndexGrid", () => {
  const cells = simulatedIndexGrid(field, "ndvi", 0.62, hashSeed("pass-1"));

  it("covers the field exactly, with cells clipped to its edge", () => {
    expect(cells.length).toBeGreaterThan(100);
    const covered = cells.reduce((sum, cell) => sum + ringAreaAcres(cell.ring), 0);
    expect(covered).toBeCloseTo(ringAreaAcres(field.coordinates[0]), 2);
  });

  it("clips a triangle so no cell pokes outside it", () => {
    const triangle: GeoPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [77.5995, 27.4995],
          [77.6005, 27.4995],
          [77.5995, 27.5005],
          [77.5995, 27.4995],
        ],
      ],
    };
    const pieces = simulatedIndexGrid(triangle, "ndmi", 0.2, 7);
    const covered = pieces.reduce((sum, cell) => sum + ringAreaAcres(cell.ring), 0);
    expect(covered).toBeCloseTo(ringAreaAcres(triangle.coordinates[0]), 2);
  });

  it("averages to the field mean and varies across the field", () => {
    const average = cells.reduce((sum, cell) => sum + cell.value, 0) / cells.length;
    expect(average).toBeCloseTo(0.62, 2);
    const values = cells.map((cell) => cell.value);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.05);
  });

  it("repeats for the same seed and changes for another", () => {
    expect(simulatedIndexGrid(field, "ndvi", 0.62, hashSeed("pass-1"))).toEqual(cells);
    expect(simulatedIndexGrid(field, "ndvi", 0.62, hashSeed("pass-2"))).not.toEqual(cells);
  });

  it("uses roughly square cells on the ground", () => {
    const square = cells.find((cell) => cell.ring.length === 5)!;
    const lngs = square.ring.map(([lng]) => lng);
    const lats = square.ring.map(([, lat]) => lat);
    const widthM =
      (Math.max(...lngs) - Math.min(...lngs)) * 111_320 * Math.cos((27.5 * Math.PI) / 180);
    const heightM = (Math.max(...lats) - Math.min(...lats)) * 110_574;
    expect(widthM / heightM).toBeCloseTo(1, 1);
    expect(ringAreaAcres(square.ring as LngLat[])).toBeLessThan(0.05);
  });
});

describe("svgProjector", () => {
  it("fits the field into the box, north up", () => {
    const project = svgProjector(field, 100, 100, 0);
    const [westX, northY] = project([77.5995, 27.5005]);
    const [eastX, southY] = project([77.6005, 27.4995]);
    expect(northY).toBeLessThan(southY);
    expect(westX).toBeLessThan(eastX);
    for (const value of [westX, northY, eastX, southY]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("draws a closed path", () => {
    const path = svgPath(field.coordinates[0], svgProjector(field, 100, 100));
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });
});
