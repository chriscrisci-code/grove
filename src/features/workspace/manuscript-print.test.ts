import { describe, expect, it } from "vitest";
import {
  MANUSCRIPT_MARGINS,
  normalizeManuscriptMargin,
  stripHtmlLinks,
} from "./manuscript-print";

describe("manuscript print helpers", () => {
  it("unwraps story links and keeps the text", () => {
    expect(
      stripHtmlLinks(
        `<p>Meet <a class="story-link" href="#page-mara">Mara Venn</a> at the quay.</p>`,
      ),
    ).toBe("<p>Meet Mara Venn at the quay.</p>");
  });

  it("normalizes margin choices", () => {
    expect(normalizeManuscriptMargin("wide")).toBe("wide");
    expect(normalizeManuscriptMargin("nope")).toBe("normal");
  });

  it("maps each margin choice to an inch size for @page", () => {
    expect(MANUSCRIPT_MARGINS.narrow.inches).toBe("0.5in");
    expect(MANUSCRIPT_MARGINS.normal.inches).toBe("1in");
    expect(MANUSCRIPT_MARGINS.wide.inches).toBe("1.5in");
  });
});
