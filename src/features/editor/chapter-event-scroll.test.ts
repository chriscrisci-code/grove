import { describe, expect, it } from "vitest";
import { dragScrollDelta } from "./chapter-event-scroll";

describe("chapter event drag scrolling", () => {
  it("scrolls up near the top edge and down near the bottom", () => {
    expect(dragScrollDelta(100, 100, 900)).toBeLessThan(0);
    expect(dragScrollDelta(180, 100, 900)).toBeLessThan(0);
    expect(dragScrollDelta(500, 100, 900)).toBe(0);
    expect(dragScrollDelta(820, 100, 900)).toBeGreaterThan(0);
    expect(dragScrollDelta(900, 100, 900)).toBeGreaterThan(0);
  });

  it("scrolls faster at the extreme edges", () => {
    const near = Math.abs(dragScrollDelta(220, 100, 900));
    const far = Math.abs(dragScrollDelta(100, 100, 900));
    expect(far).toBeGreaterThan(near);
  });
});
