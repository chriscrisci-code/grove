import { describe, expect, it } from "vitest";
import {
  PREVIEW_BILLING_STATE,
  canSwitchActiveStory,
  formatActiveStorySwitchDate,
  normalizeBillingState,
} from "./billing-state";

describe("billing state", () => {
  it("fails open to preview access before billing is connected", () => {
    expect(normalizeBillingState(null)).toEqual(PREVIEW_BILLING_STATE);
  });

  it("normalizes Stripe subscription fields", () => {
    expect(
      normalizeBillingState({
        effectivePlan: "plus",
        previewMode: false,
        subscriptionStatus: "active",
        hasStripeCustomer: true,
      }),
    ).toMatchObject({
      subscriptionStatus: "active",
      hasStripeCustomer: true,
      previewMode: false,
    });
  });

  it("normalizes a free account and its active story", () => {
    expect(
      normalizeBillingState({
        effectivePlan: "free",
        previewMode: false,
        activeWorkspaceId: "story-1",
        activeWorkspaceChangedAt: "2026-08-01T00:00:00.000Z",
        nextActiveSwitchAt: "2026-08-31T00:00:00.000Z",
      }),
    ).toMatchObject({
      effectivePlan: "free",
      previewMode: false,
      activeWorkspaceId: "story-1",
    });
  });

  it("enforces the active story switch date", () => {
    const next = "2026-09-01T12:00:00.000Z";
    expect(canSwitchActiveStory(next, null, Date.parse("2026-08-20"))).toBe(
      false,
    );
    expect(
      canSwitchActiveStory(
        next,
        null,
        Date.parse("2026-09-01T12:00:00.000Z"),
      ),
    ).toBe(true);
    expect(formatActiveStorySwitchDate(next)).toBe("Sep 1, 2026");
  });

  it("allows reconsidering the active story during the grace period", () => {
    expect(
      canSwitchActiveStory(
        "2026-09-20T12:00:00.000Z",
        "2026-09-05T12:00:00.000Z",
        Date.parse("2026-09-03T12:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
