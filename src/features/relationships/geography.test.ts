import { describe, expect, it } from "vitest";
import {
  constrainGeographyAngle,
  emptyGeographyDocument,
  normalizeGeographyDocument,
  pointsAttribute,
  polygonCentroid,
} from "./geography";

describe("geography helpers", () => {
  it("normalizes empty and malformed documents", () => {
    expect(normalizeGeographyDocument(null)).toEqual(emptyGeographyDocument());
    expect(
      normalizeGeographyDocument({
        canvas: { width: 20, height: 9000 },
        layers: [{ kind: "unknown", points: [] }],
      }).canvas,
    ).toEqual({ width: 600, height: 4000 });
  });

  it("keeps valid map layers and sanitizes their style", () => {
    const document = normalizeGeographyDocument({
      version: 99,
      layers: [
        {
          id: "region",
          kind: "region",
          name: "North",
          points: [
            [0, 0],
            [100, 0],
            [100, 100],
          ],
          style: {
            fill: "#abcdef",
            stroke: "bad",
            strokeWidth: 50,
            opacity: 4,
          },
        },
      ],
    });
    expect(document.layers[0]).toMatchObject({
      id: "region",
      kind: "region",
      style: {
        fill: "#abcdef",
        stroke: "#526357",
        strokeWidth: 12,
        opacity: 1,
      },
    });
  });

  it("formats points, finds a centroid, and constrains angles", () => {
    expect(
      pointsAttribute([
        [1, 2],
        [3, 4],
      ]),
    ).toBe("1,2 3,4");
    expect(
      polygonCentroid([
        [0, 0],
        [6, 0],
        [3, 6],
      ]),
    ).toEqual([3, 2]);
    const [, y] = constrainGeographyAngle([0, 0], [10, 1]);
    expect(y).toBeCloseTo(0);
  });
});
