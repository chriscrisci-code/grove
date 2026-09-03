import { describe, expect, it } from "vitest";
import {
  DONATE_MAX_CENTS,
  DONATE_MIN_CENTS,
  dollarsToCents,
  normalizeDonateAmountCents,
} from "./donate";

describe("donate amounts", () => {
  it("accepts amounts between $1 and $500", () => {
    expect(normalizeDonateAmountCents(DONATE_MIN_CENTS)).toBe(100);
    expect(normalizeDonateAmountCents(2500)).toBe(2500);
    expect(normalizeDonateAmountCents(DONATE_MAX_CENTS)).toBe(50_000);
  });

  it("rejects amounts outside the range", () => {
    expect(normalizeDonateAmountCents(0)).toBeNull();
    expect(normalizeDonateAmountCents(99)).toBeNull();
    expect(normalizeDonateAmountCents(50_001)).toBeNull();
    expect(normalizeDonateAmountCents("nope")).toBeNull();
  });

  it("converts dollars to cents", () => {
    expect(dollarsToCents("10")).toBe(1000);
    expect(dollarsToCents("5.50")).toBe(550);
    expect(dollarsToCents(0.5)).toBeNull();
  });
});
