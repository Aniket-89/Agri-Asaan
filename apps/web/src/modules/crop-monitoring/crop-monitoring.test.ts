import { describe, expect, it } from "vitest";

import type { GeoPolygon } from "@/lib/maps/geo";

import { ageInDays, CLOUD_COLOR, healthStatus, indexColor } from "./indices";
import { cellsFor, parsePixelFile } from "./pixel-file";
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

  it("shows pixels without a value as cloud grey", () => {
    expect(indexColor("ndvi", null)).toBe(CLOUD_COLOR);
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

describe("parsePixelFile and cellsFor", () => {
  const file = {
    version: 1,
    observedAt: "2026-11-20T05:30:00+00:00",
    cells: [
      {
        ring: [
          [77.5995, 27.4995],
          [77.5996, 27.4995],
          [77.5996, 27.4996],
          [77.5995, 27.4995],
        ],
        ndvi: 0.61,
        ndre: 0.38,
        ndmi: 0.2,
      },
      {
        ring: [
          [77.5996, 27.4995],
          [77.5997, 27.4995],
          [77.5997, 27.4996],
          [77.5996, 27.4995],
        ],
        ndvi: null,
        ndre: null,
        ndmi: null,
      },
    ],
  };

  it("reads the worker's pixel file", () => {
    const cells = parsePixelFile(file);
    expect(cells).toHaveLength(2);
    expect(cellsFor("ndre", cells!)).toEqual([
      { ring: file.cells[0].ring, value: 0.38 },
      { ring: file.cells[1].ring, value: null },
    ]);
  });

  it("rejects files of another version or with out-of-range values", () => {
    expect(parsePixelFile({ ...file, version: 2 })).toBeNull();
    expect(parsePixelFile({ ...file, cells: [{ ...file.cells[0], ndvi: 3 }] })).toBeNull();
    expect(parsePixelFile("not json")).toBeNull();
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
