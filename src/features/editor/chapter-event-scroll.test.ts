import { describe, expect, it } from "vitest";
import { dragScrollDelta } from "./chapter-event-scroll";

describe("chapter event drag scrolling", () => {
  it("scrolls up near the top edge and down near the bottom", () => {
    expect(dragScrollDelta(100, 100, 700)).toBeLessThan(0);
    expect(dragScrollDelta(140, 100, 700)).toBeLessThan(0);
    expect(dragScrollDelta(400, 100, 700)).toBe(0);
    expect(dragScrollDelta(660, 100, 700)).toBeGreaterThan(0);
    expect(dragScrollDelta(700, 100, 700)).toBeGreaterThan(0);
  });

  it("scrolls faster at the extreme edges", () => {
    const near = Math.abs(dragScrollDelta(170, 100, 700));
    const far = Math.abs(dragScrollDelta(100, 100, 700));
    expect(far).toBeGreaterThan(near);
  });
});
