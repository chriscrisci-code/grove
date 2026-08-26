import { describe, expect, it } from "vitest";
import {
  eventIdsInScriptHtml,
  expandScriptEventMarkers,
  insertScriptEventMarker,
  removeScriptEventMarker,
  scriptEventChildren,
  scriptEventMarkerHtml,
  syncScriptEventMarkers,
} from "./script-events";

describe("script event markers", () => {
  it("inserts a marker once", () => {
    const html = insertScriptEventMarker(
      '<p data-script="action">Once upon a time.</p>',
      "evt-1",
    );
    expect(eventIdsInScriptHtml(html)).toEqual(["evt-1"]);
    expect(insertScriptEventMarker(html, "evt-1")).toBe(html);
  });

  it("keeps existing order when syncing new events", () => {
    const withOne = insertScriptEventMarker(
      '<p data-script="action">Start.</p>',
      "a",
    );
    const synced = syncScriptEventMarkers(withOne, ["a", "b"]);
    expect(eventIdsInScriptHtml(synced)).toEqual(["a", "b"]);
  });

  it("removes markers for events that left the script", () => {
    const html = `${scriptEventMarkerHtml("a")}${scriptEventMarkerHtml("b")}`;
    expect(eventIdsInScriptHtml(removeScriptEventMarker(html, "a"))).toEqual([
      "b",
    ]);
    expect(eventIdsInScriptHtml(syncScriptEventMarkers(html, ["b"]))).toEqual([
      "b",
    ]);
  });

  it("expands markers to script event text for print", () => {
    const html = `<p data-script="action">Before.</p>${scriptEventMarkerHtml("storm")}<p data-script="action">After.</p>`;
    const expanded = expandScriptEventMarkers(html, [
      {
        id: "storm",
        content: '<p data-script="action">Rain hit the quay.</p>',
      },
    ]);
    expect(expanded).toBe(
      '<p data-script="action">Before.</p><p data-script="action">Rain hit the quay.</p><p data-script="action">After.</p>',
    );
    expect(expanded).not.toContain("script-event");
  });

  it("lists nested script events in script text order", () => {
    const pages = [
      {
        id: "sc1",
        parentId: null,
        pageType: "script",
        content: `<p data-script="action">Open.</p>${scriptEventMarkerHtml("b")}<p data-script="action">Mid.</p>${scriptEventMarkerHtml("a")}`,
      },
      { id: "a", parentId: "sc1", pageType: "script_event" },
      { id: "b", parentId: "sc1", pageType: "script_event" },
    ];
    expect(scriptEventChildren(pages, "sc1").map((page) => page.id)).toEqual([
      "b",
      "a",
    ]);
  });
});
