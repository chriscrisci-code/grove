import { describe, expect, it } from "vitest";
import { applyPageTypeChange, reorderAmong } from "./page-tree";
import {
  PAGE_TYPE_FIELDS,
  normalizeFamilyRelationshipKind,
  normalizePageFields,
  normalizePageType,
  parseAkaNames,
} from "./page-types";

const pages = [
  { id: "notes", parentId: null, pageType: "page" as const },
  { id: "mara", parentId: "notes", pageType: "page" as const },
  { id: "one", parentId: null, pageType: "chapter" as const },
  { id: "two", parentId: null, pageType: "chapter" as const },
];

describe("page types and chapter order", () => {
  it("defaults unknown types to page", () => {
    expect(normalizePageType("character")).toBe("character");
    expect(normalizePageType("nope")).toBe("page");
  });

  it("moves a page to chapters and reparents its children", () => {
    const next = applyPageTypeChange(pages, "notes", "chapter");
    expect(next.find((page) => page.id === "notes")?.pageType).toBe("chapter");
    expect(next.find((page) => page.id === "notes")?.parentId).toBeNull();
    expect(next.find((page) => page.id === "mara")?.parentId).toBeNull();
  });

  it("returns a chapter to the page tree as a root", () => {
    const next = applyPageTypeChange(
      applyPageTypeChange(pages, "mara", "chapter"),
      "mara",
      "character",
    );
    expect(next.find((page) => page.id === "mara")?.pageType).toBe("character");
    expect(next.find((page) => page.id === "mara")?.parentId).toBeNull();
  });

  it("reorders only chapter pages", () => {
    const next = reorderAmong(
      pages,
      (page) => page.pageType === "chapter",
      "two",
      "one",
    );
    expect(
      next.filter((page) => page.pageType === "chapter").map((page) => page.id),
    ).toEqual(["two", "one"]);
    expect(next.find((page) => page.id === "mara")?.parentId).toBe("notes");
  });

  it("keeps an event nested in the page tree", () => {
    const next = applyPageTypeChange(pages, "mara", "event");
    expect(next.find((page) => page.id === "mara")?.pageType).toBe("event");
    expect(next.find((page) => page.id === "mara")?.parentId).toBe("notes");
  });

  it("splits also-known-as names on commas", () => {
    expect(parseAkaNames("E-Town, the White City, e-town")).toEqual([
      "E-Town",
      "the White City",
    ]);
  });

  it("keeps only also-known-as on typed pages", () => {
    expect(PAGE_TYPE_FIELDS.character.map((field) => field.key)).toEqual([
      "aka",
    ]);
    expect(PAGE_TYPE_FIELDS.location.map((field) => field.key)).toEqual([
      "aka",
    ]);
    expect(PAGE_TYPE_FIELDS.unique_object.map((field) => field.key)).toEqual([
      "aka",
    ]);
    expect(
      normalizePageFields({
        aka: "The Fox",
        role: "Hero",
        region: "North",
        timelineY: "120",
      }),
    ).toEqual({ aka: "The Fox", timelineY: "120" });
  });

  it("normalizes family relationship kinds", () => {
    expect(normalizeFamilyRelationshipKind("adoptive_parent_of")).toBe(
      "adoptive_parent_of",
    );
    expect(normalizeFamilyRelationshipKind("sibling")).toBeNull();
  });
});
