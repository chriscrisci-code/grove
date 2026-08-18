import { describe, expect, it } from "vitest";
import {
  collapseRepeatedLead,
  shouldKeepDictationAlive,
  speechInsertDelta,
} from "./dictation";

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

describe("dictation pause", () => {
  it("restarts while the user still wants the mic and speech was recent", () => {
    expect(shouldKeepDictationAlive(true, 1_000, 20_000)).toBe(true);
  });

  it("stops after 30 seconds of silence or when the user taps Stop", () => {
    expect(shouldKeepDictationAlive(true, 1_000, 32_000)).toBe(false);
    expect(shouldKeepDictationAlive(false, 1_000, 2_000)).toBe(false);
  });
});
