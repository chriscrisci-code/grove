import { describe, expect, it } from "vitest";
import { collapseRepeatedLead, speechInsertDelta } from "./dictation";

describe("mobile dictation echoes", () => {
  it("keeps one copy when the first two words repeat three times", () => {
    expect(
      collapseRepeatedLead(
        "hello world hello world hello world this is a test",
      ),
    ).toBe("hello world this is a test");
  });

  it("does not change ordinary sentences", () => {
    expect(collapseRepeatedLead("the cat sat on the mat")).toBe(
      "the cat sat on the mat",
    );
  });

  it("only inserts new words after a growing final result", () => {
    expect(speechInsertDelta("hello world", "hello world")).toBe("");
    expect(
      speechInsertDelta("hello world", "hello world this is a test"),
    ).toBe("this is a test");
    expect(
      speechInsertDelta(
        "hello world",
        "hello world hello world hello world this is a test",
      ),
    ).toBe("this is a test");
  });

  it("skips a shorter restatement of the same phrase", () => {
    expect(speechInsertDelta("hello world this is", "hello world")).toBe("");
  });

  it("does not insert an earlier chunk again when the engine repeats it", () => {
    expect(speechInsertDelta("hello world this is", "this is")).toBe("");
  });
});
