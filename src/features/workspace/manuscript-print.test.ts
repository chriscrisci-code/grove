import { describe, expect, it } from "vitest";
import {
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
});
