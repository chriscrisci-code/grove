import { describe, expect, it } from "vitest";
import {
  applyQuotedSuggestion,
  collaboratorRoleLabel,
  isInviteEmail,
  normalizeInviteEmail,
} from "./collaboration";

describe("collaboration helpers", () => {
  it("normalizes invite emails", () => {
    expect(normalizeInviteEmail("  Alex@Grove.app ")).toBe("alex@grove.app");
    expect(isInviteEmail("writer@example.com")).toBe(true);
    expect(isInviteEmail("not-an-email")).toBe(false);
  });

  it("labels reviewer and editor roles for writers", () => {
    expect(collaboratorRoleLabel("viewer")).toBe("Reviewer");
    expect(collaboratorRoleLabel("editor")).toBe("Editor");
    expect(collaboratorRoleLabel("owner")).toBe("Owner");
  });

  it("replaces quoted story text with a suggestion", () => {
    expect(
      applyQuotedSuggestion(
        "<p>The lantern flared once.</p>",
        "lantern flared",
        "lantern blossomed",
      ),
    ).toBe("<p>The lantern blossomed once.</p>");
  });

  it("does not guess when the quote is gone", () => {
    expect(
      applyQuotedSuggestion("<p>Hello</p>", "missing quote", "replacement"),
    ).toBeNull();
  });
});
