import { describe, expect, it } from "vitest";
import {
  defaultWebPosition,
  webPositionFromFields,
  withWebPosition,
} from "./web-layout";

describe("web layout", () => {
  it("scatters nodes instead of locking them to a ring", () => {
    const first = defaultWebPosition(0);
    const second = defaultWebPosition(1);
    expect(first).toEqual({ x: 110, y: 90 });
    expect(second.x).not.toBe(first.x);
    expect(second.y).toBe(first.y);
  });

  it("reads and writes a free-floating position", () => {
    expect(webPositionFromFields({})).toBeNull();
    const next = withWebPosition({ aka: "Mara" }, 240.4, 88.2);
    expect(next).toEqual({ aka: "Mara", webX: "240", webY: "88" });
    expect(webPositionFromFields(next)).toEqual({ x: 240, y: 88 });
  });
});
