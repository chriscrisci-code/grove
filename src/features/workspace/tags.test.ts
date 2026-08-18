import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAG_COLOR,
  TAG_COLOR_PALETTE,
  filterTags,
  isAllowedTagColor,
  normalizeTagColor,
  normalizeTagName,
} from "./tags";

const tags = [
  { id: "3", name: "Timeline" },
  { id: "1", name: "Magic system" },
  { id: "2", name: "Character arc" },
  { id: "4", name: "Arc notes" },
];

describe("tag helpers", () => {
  it("normalizes names for storage and comparison", () => {
    expect(normalizeTagName("  Character   arc  ")).toBe("Character arc");
    expect(normalizeTagName("x".repeat(60))).toHaveLength(40);
  });

  it("shows every tag alphabetically until typing narrows the options", () => {
    expect(filterTags(tags, "").map((tag) => tag.name)).toEqual([
      "Arc notes",
      "Character arc",
      "Magic system",
      "Timeline",
    ]);
    expect(filterTags(tags, "arc").map((tag) => tag.name)).toEqual([
      "Arc notes",
      "Character arc",
    ]);
    expect(filterTags(tags, "no match")).toEqual([]);
  });

  it("matches without regard to case and ranks prefixes first", () => {
    expect(filterTags(tags, "M").map((tag) => tag.name)).toEqual([
      "Magic system",
      "Timeline",
    ]);
  });

  it("offers sixteen allowed colors and defaults invalid values", () => {
    expect(TAG_COLOR_PALETTE).toHaveLength(16);
    expect(isAllowedTagColor(TAG_COLOR_PALETTE[5]!.value)).toBe(true);
    expect(isAllowedTagColor("#ffffff")).toBe(false);
    expect(normalizeTagColor("#FFFFFF")).toBe(DEFAULT_TAG_COLOR);
    expect(normalizeTagColor(null)).toBe(DEFAULT_TAG_COLOR);
  });
});
