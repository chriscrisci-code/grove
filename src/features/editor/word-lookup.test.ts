import { describe, expect, it } from "vitest";
import { matchCasing, pickThesaurusWords, wordRangeAt } from "./word-lookup";

describe("word at click", () => {
  it("finds the word under an offset", () => {
    expect(wordRangeAt("The recieve was late.", 6)).toEqual({
      start: 4,
      end: 11,
      word: "recieve",
    });
  });

  it("uses the word to the left when clicking the trailing space", () => {
    expect(wordRangeAt("grove ", 6)?.word).toBe("grove");
    expect(wordRangeAt("grove.", 5)?.word).toBe("grove");
  });

  it("skips tiny tokens", () => {
    expect(wordRangeAt("a big oak", 0)).toBeNull();
  });

  it("keeps the writer's capitalization", () => {
    expect(matchCasing("Recieve", "receive")).toBe("Receive");
    expect(matchCasing("GROVE", "forest")).toBe("FOREST");
  });
});

describe("thesaurus picks", () => {
  it("puts synonyms first and keeps similar words separate", () => {
    expect(
      pickThesaurusWords(
        ["orchard", "woodlet", "grove"],
        ["forest", "woods", "orchard", "walk of life"],
        "grove",
      ),
    ).toEqual({
      synonyms: ["orchard", "woodlet"],
      related: ["forest", "woods"],
    });
  });
});
