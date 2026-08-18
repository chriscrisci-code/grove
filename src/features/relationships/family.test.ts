import { describe, expect, it } from "vitest";
import {
  canonicalFamilyPair,
  familyRelationships,
  layoutFamilyTree,
  validateFamilyRelationship,
} from "./family";

const pages = [
  { id: "a", title: "Ari", pageType: "character" as const },
  { id: "b", title: "Bea", pageType: "character" as const },
  { id: "c", title: "Cy", pageType: "character" as const },
  { id: "place", title: "City", pageType: "location" as const },
];

describe("family relationships", () => {
  it("canonicalizes symmetric partner relationships", () => {
    expect(canonicalFamilyPair("z", "a", "partner")).toEqual({
      fromPageId: "a",
      toPageId: "z",
    });
    expect(canonicalFamilyPair("z", "a", "parent_of")).toEqual({
      fromPageId: "z",
      toPageId: "a",
    });
  });

  it("rejects non-characters, duplicates, and parent cycles", () => {
    const relationships = [
      {
        id: "1",
        fromPageId: "a",
        toPageId: "b",
        label: "parent of",
        kind: "parent_of" as const,
      },
    ];
    expect(
      validateFamilyRelationship({
        pages,
        relationships,
        fromPageId: "place",
        toPageId: "a",
        kind: "parent_of",
      }),
    ).toContain("Character");
    expect(
      validateFamilyRelationship({
        pages,
        relationships,
        fromPageId: "a",
        toPageId: "b",
        kind: "parent_of",
      }),
    ).toContain("already");
    expect(
      validateFamilyRelationship({
        pages,
        relationships,
        fromPageId: "b",
        toPageId: "a",
        kind: "parent_of",
      }),
    ).toContain("cycle");
  });

  it("places children below parents and partners on one generation", () => {
    const relationships = [
      {
        id: "1",
        fromPageId: "a",
        toPageId: "c",
        label: "parent of",
        kind: "parent_of" as const,
      },
      {
        id: "2",
        fromPageId: "a",
        toPageId: "b",
        label: "partner",
        kind: "partner" as const,
      },
    ];
    const layout = layoutFamilyTree(pages, relationships);
    const ari = layout.nodes.find((node) => node.id === "a")!;
    const bea = layout.nodes.find((node) => node.id === "b")!;
    const cy = layout.nodes.find((node) => node.id === "c")!;
    expect(bea.y).toBe(ari.y);
    expect(cy.y).toBeGreaterThan(ari.y);
    expect(familyRelationships(relationships)).toHaveLength(2);
  });
});
