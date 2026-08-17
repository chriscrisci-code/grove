import { describe, expect, it } from "vitest";
import {
  applyPageDrop,
  dropPlacementFromOffset,
  isDescendantOf,
} from "./page-tree";

const pages = [
  { id: "welcome", parentId: null },
  { id: "characters", parentId: null },
  { id: "mara", parentId: "characters" },
  { id: "places", parentId: null },
];

describe("page tree drops", () => {
  it("reorders a page before a sibling", () => {
    const next = applyPageDrop(pages, "places", {
      type: "before",
      targetId: "welcome",
    });
    expect(next?.map((page) => page.id)).toEqual([
      "places",
      "welcome",
      "characters",
      "mara",
    ]);
    expect(next?.find((page) => page.id === "places")?.parentId).toBeNull();
  });

  it("reorders a page after a sibling", () => {
    const next = applyPageDrop(pages, "welcome", {
      type: "after",
      targetId: "places",
    });
    expect(
      next
        ?.filter((page) => page.parentId === null)
        .map((page) => page.id),
    ).toEqual(["characters", "places", "welcome"]);
  });

  it("nests a page as the last child", () => {
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

  it("moves a nested page back to the root", () => {
    const next = applyPageDrop(pages, "mara", {
      type: "after",
      targetId: "places",
    });
    expect(next?.find((page) => page.id === "mara")?.parentId).toBeNull();
    expect(
      next
        ?.filter((page) => page.parentId === null)
        .map((page) => page.id),
    ).toEqual(["welcome", "characters", "places", "mara"]);
  });

  it("keeps nested children with a moved parent", () => {
    const next = applyPageDrop(pages, "characters", {
      type: "after",
      targetId: "places",
    });
    expect(next?.find((page) => page.id === "mara")?.parentId).toBe(
      "characters",
    );
    expect(
      next
        ?.filter((page) => page.parentId === null)
        .map((page) => page.id),
    ).toEqual(["welcome", "places", "characters"]);
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
        type: "before",
        targetId: "characters",
      }),
    ).toBeNull();
  });

  it("knows descendant relationships", () => {
    expect(isDescendantOf(pages, "characters", "mara")).toBe(true);
    expect(isDescendantOf(pages, "mara", "characters")).toBe(false);
  });

  it("maps pointer position to drop placement", () => {
    expect(dropPlacementFromOffset(0.1)).toBe("before");
    expect(dropPlacementFromOffset(0.5)).toBe("inside");
    expect(dropPlacementFromOffset(0.9)).toBe("after");
  });
});
