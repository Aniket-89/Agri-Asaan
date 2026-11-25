import { describe, expect, it } from "vitest";

import { parseCoordinate, pinBounds, toPolygon, type MapPin } from "./geo";

const square = {
  type: "Polygon",
  coordinates: [
    [
      [77.0, 29.0],
      [77.01, 29.0],
      [77.01, 29.01],
      [77.0, 29.01],
      [77.0, 29.0],
    ],
  ],
};

describe("toPolygon", () => {
  it("accepts a well-formed GeoJSON polygon", () => {
    expect(toPolygon(square)).toEqual(square);
  });

  it("drops anything else", () => {
    expect(toPolygon(null)).toBeNull();
    expect(toPolygon({ type: "Point", coordinates: [77, 29] })).toBeNull();
    expect(toPolygon({ type: "Polygon", coordinates: [[[77, 29]]] })).toBeNull();
    expect(
      toPolygon({
        type: "Polygon",
        coordinates: [
          [
            [500, 29],
            [77, 29],
            [77, 30],
            [500, 29],
          ],
        ],
      })
    ).toBeNull();
  });
});

describe("pinBounds", () => {
  const pin = (latitude: number, longitude: number, extra: Partial<MapPin> = {}): MapPin => ({
    id: `${latitude},${longitude}`,
    label: "Field",
    latitude,
    longitude,
    ...extra,
  });

  it("returns null without pins", () => {
    expect(pinBounds([])).toBeNull();
  });

  it("spans every pin", () => {
    expect(pinBounds([pin(29.0, 77.0), pin(26.9, 75.8)])).toEqual([
      [75.8, 26.9],
      [77.0, 29.0],
    ]);
  });

  it("includes boundary vertices", () => {
    expect(pinBounds([pin(29.005, 77.005, { boundary: toPolygon(square) })])).toEqual([
      [77.0, 29.0],
      [77.01, 29.01],
    ]);
  });
});

describe("parseCoordinate", () => {
  it("parses typed coordinates within range", () => {
    expect(parseCoordinate("29.002", 90)).toBe(29.002);
    expect(parseCoordinate("-75.5", 180)).toBe(-75.5);
  });

  it("rejects empty, invalid, or out-of-range input", () => {
    expect(parseCoordinate("", 90)).toBeNull();
    expect(parseCoordinate("abc", 90)).toBeNull();
    expect(parseCoordinate("91", 90)).toBeNull();
  });
});
