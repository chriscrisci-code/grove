import { describe, expect, it } from "vitest";
import {
  chapterEventChildren,
  chapterEventMarkerHtml,
  eventIdsInChapterHtml,
  expandChapterEventMarkers,
  insertChapterEventMarker,
  removeChapterEventMarker,
  syncChapterEventMarkers,
} from "./chapter-events";

describe("chapter event markers", () => {
  it("inserts a marker once", () => {
    const html = insertChapterEventMarker("<p>Once upon a time.</p>", "evt-1");
    expect(eventIdsInChapterHtml(html)).toEqual(["evt-1"]);
    expect(insertChapterEventMarker(html, "evt-1")).toBe(html);
  });

  it("keeps existing order when syncing new events", () => {
    const withOne = insertChapterEventMarker("<p>Start.</p>", "a");
    const synced = syncChapterEventMarkers(withOne, ["a", "b"]);
    expect(eventIdsInChapterHtml(synced)).toEqual(["a", "b"]);
  });

  it("removes markers for events that left the chapter", () => {
    const html = `${chapterEventMarkerHtml("a")}${chapterEventMarkerHtml("b")}`;
    expect(eventIdsInChapterHtml(removeChapterEventMarker(html, "a"))).toEqual([
      "b",
    ]);
    expect(eventIdsInChapterHtml(syncChapterEventMarkers(html, ["b"]))).toEqual([
      "b",
    ]);
  });

  it("expands markers to event text for print without titles or synopsis", () => {
    const html = `<p>Before.</p>${chapterEventMarkerHtml("storm")}<p>After.</p>`;
    const expanded = expandChapterEventMarkers(html, [
      {
        id: "storm",
        content: "<p>Rain hit the quay.</p>",
      },
    ]);
    expect(expanded).toBe(
      "<p>Before.</p><p>Rain hit the quay.</p><p>After.</p>",
    );
    expect(expanded).not.toContain("The Storm");
    expect(expanded).not.toContain("A sudden squall");
    expect(expanded).not.toContain("manuscript-event");
    expect(expanded).not.toContain("<h3>");
    expect(expanded).not.toContain("chapter-event");
  });

  it("lists nested events in chapter text order", () => {
    const pages = [
      {
        id: "ch1",
        parentId: null,
        pageType: "chapter",
        content: `<p>Open.</p>${chapterEventMarkerHtml("b")}<p>Mid.</p>${chapterEventMarkerHtml("a")}`,
      },
      { id: "a", parentId: "ch1", pageType: "event" },
      { id: "b", parentId: "ch1", pageType: "event" },
    ];
    expect(chapterEventChildren(pages, "ch1").map((page) => page.id)).toEqual([
      "b",
      "a",
    ]);
  });
});
