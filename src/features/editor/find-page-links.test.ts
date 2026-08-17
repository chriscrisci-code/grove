import { describe, expect, it } from "vitest";
import { findPageTitleMatches } from "./find-page-links";

const pages = [
  { id: "evermere", title: "Evermere" },
  { id: "falls", title: "Evermere Falls" },
  { id: "mara", title: "Mara Venn" },
  { id: "untitled", title: "Untitled" },
  { id: "a", title: "A" },
];

describe("find page title matches", () => {
  it("matches titles case-insensitively with word boundaries", () => {
    expect(
      findPageTitleMatches("She reached evermere before dusk.", pages),
    ).toEqual([{ from: 12, to: 20, pageId: "evermere" }]);
  });

  it("prefers the longest title when names overlap", () => {
    expect(
      findPageTitleMatches("They crossed Evermere Falls at dawn.", pages),
    ).toEqual([{ from: 13, to: 27, pageId: "falls" }]);
  });

  it("skips partial words, untitled pages, and one-letter titles", () => {
    expect(findPageTitleMatches("Maybe A visited Untitled.", pages)).toEqual(
      [],
    );
  });

  it("still links a name before a possessive", () => {
    expect(findPageTitleMatches("Evermere's ridge", pages)).toEqual([
      { from: 0, to: 8, pageId: "evermere" },
    ]);
  });
});
