import { describe, expect, it } from "vitest";
import {
  collapseGrowingRestatement,
  collapseRepeatedLead,
  mergeDictationTranscript,
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

describe("growing dictation restatements", () => {
  const chunks = [
    "testing",
    "testing to",
    "testing to see",
    "testing to see how",
    "testing to see how long",
    "testing to see how long the",
    "testing to see how long the dictation",
    "testing to see how long the dictation will",
    "testing to see how long the dictation will stay",
    "testing to see how long the dictation will stay open",
  ];

  it("keeps one sentence as the engine restates the phrase so far", () => {
    let committed = "";
    for (const chunk of chunks) {
      committed = mergeDictationTranscript(committed, chunk);
    }
    expect(committed).toBe(
      "testing to see how long the dictation will stay open",
    );
  });

  it("repairs a concatenated growing restatement", () => {
    expect(collapseGrowingRestatement(chunks.join(" "))).toBe(
      "testing to see how long the dictation will stay open",
    );
  });

  it("appends a new sentence after the first one is done", () => {
    expect(
      mergeDictationTranscript(
        "testing to see how long the dictation will stay open",
        "okay next line",
      ),
    ).toBe("testing to see how long the dictation will stay open okay next line");
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
