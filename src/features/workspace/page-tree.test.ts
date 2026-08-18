import { describe, expect, it } from "vitest";
import {
  applyPageDrop,
  dropPlacementFromOffset,
  filterStoryPages,
  isDescendantOf,
  siblingPages,
} from "./page-tree";

const pages = [
  { id: "welcome", parentId: null, title: "Welcome", pageType: "page" },
  { id: "characters", parentId: null, title: "Characters", pageType: "page" },
  { id: "mara", parentId: "characters", title: "Mara", pageType: "character" },
  { id: "places", parentId: null, title: "Places", pageType: "page" },
];

describe("page tree drops", () => {
  it("nests a page under a label", () => {
    const next = applyPageDrop(pages, "places", {
      type: "inside",
      targetId: "characters",
    });
    expect(next?.find((page) => page.id === "places")?.parentId).toBe(
      "characters",
    );
    expect(
      next
        ?.filter((page) => page.parentId === "characters")
        .map((page) => page.id),
    ).toEqual(["mara", "places"]);
  });

  it("moves a nested page back to Your story", () => {
    const next = applyPageDrop(pages, "mara", { type: "root" });
    expect(next?.find((page) => page.id === "mara")?.parentId).toBeNull();
  });

  it("does not reorder by dropping onto the current parent", () => {
    expect(
      applyPageDrop(pages, "mara", { type: "inside", targetId: "characters" }),
    ).toBeNull();
    expect(applyPageDrop(pages, "welcome", { type: "root" })).toBeNull();
  });

  it("keeps nested children with a moved parent", () => {
    const next = applyPageDrop(pages, "characters", {
      type: "inside",
      targetId: "places",
    });
    expect(next?.find((page) => page.id === "mara")?.parentId).toBe(
      "characters",
    );
    expect(next?.find((page) => page.id === "characters")?.parentId).toBe(
      "places",
    );
  });

  it("rejects dropping a page onto itself or its descendant", () => {
    expect(
      applyPageDrop(pages, "characters", {
        type: "inside",
        targetId: "mara",
      }),
    ).toBeNull();
    expect(
      applyPageDrop(pages, "characters", {
        type: "inside",
        targetId: "characters",
      }),
    ).toBeNull();
  });

  it("knows descendant relationships", () => {
    expect(isDescendantOf(pages, "characters", "mara")).toBe(true);
    expect(isDescendantOf(pages, "mara", "characters")).toBe(false);
  });

  it("maps chapter pointer position to before or after", () => {
    expect(dropPlacementFromOffset(0.1)).toBe("before");
    expect(dropPlacementFromOffset(0.9)).toBe("after");
  });
});

describe("your story listing", () => {
  it("alphabetizes siblings and keeps children with their parent", () => {
    const shuffled = [
      { id: "zeta", parentId: null, title: "Zeta" },
      { id: "beta", parentId: "alpha", title: "Beta child" },
      { id: "alpha", parentId: null, title: "Alpha" },
      { id: "aardvark", parentId: "alpha", title: "Aardvark" },
    ];
    expect(siblingPages(shuffled, null).map((page) => page.id)).toEqual([
      "alpha",
      "zeta",
    ]);
    expect(siblingPages(shuffled, "alpha").map((page) => page.id)).toEqual([
      "aardvark",
      "beta",
    ]);
  });

  it("filters by page type and keeps ancestor labels", () => {
    const visible = filterStoryPages(pages, { types: ["character"] });
    expect(visible.map((page) => page.id)).toEqual(["characters", "mara"]);
  });

  it("filters by title and keeps the parent path", () => {
    const visible = filterStoryPages(pages, { query: "mara" });
    expect(visible.map((page) => page.id)).toEqual(["characters", "mara"]);
  });
});
