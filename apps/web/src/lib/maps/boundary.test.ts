import { describe, expect, it } from "vitest";

import {
  boundaryProblem,
  cornersToPolygon,
  distanceMetres,
  pointInRing,
  ringAreaAcres,
  ringCrossesItself,
  type LngLat,
} from "./boundary";

const pin: LngLat = [77.6, 27.5];
// ~99 m x 111 m around the pin: about 2.7 acres.
const square: LngLat[] = [
  [77.5995, 27.4995],
  [77.6005, 27.4995],
  [77.6005, 27.5005],
  [77.5995, 27.5005],
];

describe("ringAreaAcres", () => {
  it("measures a field-sized square", () => {
    expect(ringAreaAcres(square)).toBeCloseTo(2.72, 1);
  });

  it("gives the same area for a closed ring and either winding", () => {
    const closed = [...square, square[0]];
    expect(ringAreaAcres(closed)).toBeCloseTo(ringAreaAcres(square), 6);
    expect(ringAreaAcres([...square].reverse())).toBeCloseTo(ringAreaAcres(square), 6);
  });

  it("is zero for fewer than three corners", () => {
    expect(ringAreaAcres(square.slice(0, 2))).toBe(0);
  });
});

describe("distanceMetres", () => {
  it("measures about 111 m per 0.001 degree of latitude", () => {
    expect(distanceMetres([77.6, 27.5], [77.6, 27.501])).toBeCloseTo(111.3, 0);
  });
});

describe("ringCrossesItself and pointInRing", () => {
  it("spots a bow-tie", () => {
    expect(ringCrossesItself([square[0], square[2], square[1], square[3]])).toBe(true);
    expect(ringCrossesItself(square)).toBe(false);
  });

  it("finds points inside and outside", () => {
    expect(pointInRing(pin, square)).toBe(true);
    expect(pointInRing([77.7, 27.5], square)).toBe(false);
  });
});

describe("boundaryProblem", () => {
  it("accepts a sensible field", () => {
    expect(boundaryProblem(square, pin)).toBeNull();
  });

  it("explains each problem", () => {
    expect(boundaryProblem(square.slice(0, 2), pin)).toBe("tooFewCorners");
    expect(boundaryProblem([square[0], square[2], square[1], square[3]], pin)).toBe("crosses");
    const tiny: LngLat[] = [
      [77.6, 27.5],
      [77.6001, 27.5],
      [77.6001, 27.5001],
    ];
    expect(boundaryProblem(tiny, pin)).toBe("tooSmall");
    const huge: LngLat[] = [
      [77.5, 27.4],
      [77.7, 27.4],
      [77.7, 27.6],
      [77.5, 27.6],
    ];
    expect(boundaryProblem(huge, pin)).toBe("tooLarge");
    expect(boundaryProblem(square, [77.61, 27.5])).toBe("tooFar");
    const many = Array.from({ length: 101 }, (_, index): LngLat => {
      const angle = (index / 101) * 2 * Math.PI;
      return [77.6 + 0.001 * Math.cos(angle), 27.5 + 0.001 * Math.sin(angle)];
    });
    expect(boundaryProblem(many, pin)).toBe("tooManyCorners");
  });

  it("allows a pin just outside the boundary", () => {
    expect(boundaryProblem(square, [77.6, 27.502])).toBeNull();
  });
});

describe("cornersToPolygon", () => {
  it("closes the ring and rounds coordinates", () => {
    const polygon = cornersToPolygon([
      [77.12345678, 27.1],
      [77.2, 27.1],
      [77.2, 27.2],
    ]);
    expect(polygon.coordinates[0]).toEqual([
      [77.123457, 27.1],
      [77.2, 27.1],
      [77.2, 27.2],
      [77.123457, 27.1],
    ]);
  });
});
