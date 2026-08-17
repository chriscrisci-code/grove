import { describe, expect, it } from "vitest";
import {
  TIMELINE_CARD_GAP,
  TIMELINE_CARD_HEIGHT,
  TIMELINE_DEFAULT_Y,
  TIMELINE_MIN_EXTENT,
  nextTrayClickY,
  parseStoredExtent,
  parseTimelineY,
  serializeTimelineLane,
  serializeTimelineY,
  snapTimelineLane,
  splitTimelinePages,
  timelineCanvasHeight,
  timelineCardWidth,
  timelineExtentStorageKey,
  withTimelineY,
  withoutTimelineY,
} from "./timeline";

const pages: {
  id: string;
  pageType: string;
  fields: Record<string, string>;
}[] = [
  {
    id: "notes",
    pageType: "page",
    fields: { timelineY: "40" },
  },
  {
    id: "one",
    pageType: "chapter",
    fields: {},
  },
  {
    id: "storm",
    pageType: "event",
    fields: { aka: "The Gale", timelineY: "120" },
  },
  {
    id: "two",
    pageType: "chapter",
    fields: { timelineY: "12" },
  },
  {
    id: "mara",
    pageType: "character",
    fields: {},
  },
];

describe("timeline helpers", () => {
  it("parses and serializes a timeline Y", () => {
    expect(parseTimelineY("84.2")).toBe(84.2);
    expect(parseTimelineY("")).toBeNull();
    expect(parseTimelineY("nope")).toBeNull();
    expect(serializeTimelineY(-4)).toBe("8");
    expect(serializeTimelineY(99.6)).toBe("100");
  });

  it("splits unused chapters and events from placed ones", () => {
    const { tray, placed } = splitTimelinePages(pages);
    expect(tray.map((page) => page.id)).toEqual(["one"]);
    expect(placed.map((page) => page.id)).toEqual(["two", "storm"]);
    expect(placed[0]?.timelineY).toBe(12);
    expect(placed[0]?.timelineLane).toBe(0);
  });

  it("snaps a drop onto one of six lanes", () => {
    expect(snapTimelineLane(10, 600)).toBe(0);
    expect(snapTimelineLane(350, 600)).toBe(3);
    expect(snapTimelineLane(599, 600)).toBe(5);
    expect(serializeTimelineLane(9)).toBe("5");
    expect(timelineCardWidth(600, 720)).toBeLessThanOrEqual(720 / 3);
  });

  it("places a tray click after the last item", () => {
    expect(nextTrayClickY([])).toBe(TIMELINE_DEFAULT_Y);
    expect(nextTrayClickY([12, 120])).toBe(120 + TIMELINE_CARD_GAP);
  });

  it("keeps also-known-as when adding or clearing a timeline Y", () => {
    const placed = withTimelineY({ aka: "The Gale" }, 40);
    expect(placed).toEqual({
      aka: "The Gale",
      timelineY: "40",
      timelineLane: "0",
    });
    expect(withoutTimelineY(placed)).toEqual({ aka: "The Gale" });
    expect(withTimelineY({ aka: "The Gale" }, 40, 4).timelineLane).toBe("4");
  });

  it("grows the canvas from viewport, items, and user scroll", () => {
    expect(
      timelineCanvasHeight({
        viewportHeight: 500,
        farthestY: 0,
        userExtent: 0,
      }),
    ).toBe(TIMELINE_MIN_EXTENT);
    expect(
      timelineCanvasHeight({
        viewportHeight: 900,
        farthestY: 40,
        userExtent: 0,
      }),
    ).toBe(900);
    expect(
      timelineCanvasHeight({
        viewportHeight: 400,
        farthestY: 800,
        userExtent: 0,
      }),
    ).toBe(800 + TIMELINE_CARD_HEIGHT + 160);
    expect(
      timelineCanvasHeight({
        viewportHeight: 400,
        farthestY: 40,
        userExtent: 2000,
      }),
    ).toBe(2000);
  });

  it("keys stored extent by workspace", () => {
    expect(timelineExtentStorageKey()).toBe("storytree-timeline-extent");
    expect(timelineExtentStorageKey("abc")).toBe(
      "storytree-timeline-extent:abc",
    );
    expect(parseStoredExtent("1800")).toBe(1800);
    expect(parseStoredExtent("nope")).toBe(0);
  });
});
