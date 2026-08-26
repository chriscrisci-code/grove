import { describe, expect, it } from "vitest";
import {
  applyScriptSlash,
  applySluglineTime,
  collectCharacterNamesFromHtml,
  cycleSluglinePrefix,
  filterCharacterSuggestions,
  htmlToPlainParagraphs,
  htmlToScriptHtml,
  isScriptHtmlEmpty,
  mergeScriptHtml,
  nextElementOnEnter,
  nextElementOnTab,
  proseParagraphsToScriptLines,
  proseToScriptHtml,
} from "./script-format";

describe("script element flow", () => {
  it("moves from character to dialogue on Enter", () => {
    expect(nextElementOnEnter("character")).toBe("dialogue");
    expect(nextElementOnEnter("dialogue")).toBe("action");
    expect(nextElementOnEnter("scene")).toBe("action");
  });

  it("moves from action to character on Tab", () => {
    expect(nextElementOnTab("action")).toBe("character");
    expect(nextElementOnTab("dialogue")).toBe("character");
    expect(nextElementOnTab("character")).toBe("parenthetical");
  });
});

describe("sluglines and slash commands", () => {
  it("cycles INT, EXT, and INT./EXT.", () => {
    expect(cycleSluglinePrefix("INT. KITCHEN - DAY").text).toBe(
      "EXT. KITCHEN - DAY",
    );
    expect(cycleSluglinePrefix("EXT. KITCHEN - DAY").text).toBe(
      "INT./EXT. KITCHEN - DAY",
    );
    expect(cycleSluglinePrefix("").text).toBe("INT.  - DAY");
  });

  it("applies time of day to a slugline", () => {
    expect(applySluglineTime("INT. ALLEY - DAY", "NIGHT")).toBe(
      "INT. ALLEY - NIGHT",
    );
    expect(applySluglineTime("INT. ALLEY", "DAWN")).toBe("INT. ALLEY - DAWN");
  });

  it("turns /int into a scene heading", () => {
    const result = applyScriptSlash("/int", "action");
    expect(result?.element).toBe("scene");
    expect(result?.text).toContain("INT.");
    expect(result?.text).toContain("DAY");
  });

  it("opens the character picker from /c, not /cut", () => {
    expect(applyScriptSlash("/c", "action")?.openCharacterPicker).toBe(true);
    expect(applyScriptSlash("/cut", "action")).toEqual({
      element: "transition",
      text: "CUT TO:",
      caret: 7,
      openCharacterPicker: false,
    });
  });
});

describe("character suggestions", () => {
  it("puts recent speakers first and filters as you type", () => {
    expect(
      filterCharacterSuggestions("ja", ["Mara", "Jane", "Joss"], ["Jane"]),
    ).toEqual(["Jane"]);
    expect(
      filterCharacterSuggestions("", ["Mara", "Jane"], ["Joss"]),
    ).toEqual(["Joss", "Mara", "Jane"]);
  });

  it("prefers prefix matches over contains matches", () => {
    expect(
      filterCharacterSuggestions("mar", ["Demar", "Mara", "Marigold"], ["Demar"]),
    ).toEqual(["Mara", "Marigold", "Demar"]);
  });
});

describe("chapter import", () => {
  it("turns attributed quotes into character and dialogue", () => {
    expect(
      proseParagraphsToScriptLines([
        "Rain hit the glass.",
        'Jane said, "We should go."',
        '"Not yet," Mara replied.',
      ]),
    ).toEqual([
      { element: "action", text: "Rain hit the glass." },
      { element: "character", text: "JANE" },
      { element: "dialogue", text: "We should go." },
      { element: "character", text: "MARA" },
      { element: "dialogue", text: "Not yet" },
    ]);
  });

  it("keeps INT headings and copies unattributed quotes to the last speaker", () => {
    const lines = proseParagraphsToScriptLines([
      "INT. HALL - NIGHT",
      "Mara asked, \"Did you hear that?\"",
      '"Yes."',
    ]);
    expect(lines[0]).toEqual({
      element: "scene",
      text: "INT. HALL - NIGHT",
    });
    expect(lines.at(-2)).toEqual({ element: "character", text: "MARA" });
    expect(lines.at(-1)).toEqual({ element: "dialogue", text: "Yes." });
  });

  it("wraps prose HTML as a first-pass script without emptying it", () => {
    const html = proseToScriptHtml(
      "<p>The door opened.</p><p>Jane said, \"Stay here.\"</p>",
    );
    expect(html).toContain('data-script="action"');
    expect(html).toContain("JANE");
    expect(html).toContain("Stay here.");
    expect(isScriptHtmlEmpty(html)).toBe(false);
  });

  it("tags ordinary HTML as action and treats blank pages as empty", () => {
    expect(htmlToScriptHtml("<p>Hello</p>")).toBe(
      '<p data-script="action">Hello</p>',
    );
    expect(isScriptHtmlEmpty("<p></p>")).toBe(true);
    expect(htmlToPlainParagraphs("<p>One</p><p>Two</p>")).toEqual([
      "One",
      "Two",
    ]);
    expect(
      collectCharacterNamesFromHtml(
        '<p data-script="character">JANE</p><p data-script="action">Runs.</p>',
      ),
    ).toEqual(["JANE"]);
    expect(
      mergeScriptHtml('<p data-script="action">A</p>', '<p data-script="scene">INT. BARN - DAY</p>'),
    ).toBe(
      '<p data-script="action">A</p><p data-script="scene">INT. BARN - DAY</p>',
    );
  });
});
