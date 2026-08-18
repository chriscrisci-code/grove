import { describe, expect, it } from "vitest";
import { hasLivePlusSubscription } from "./billing-state";
import { mapStripeSubscriptionStatus, stripeObjectId } from "./stripe-status";

describe("stripe subscription mapping", () => {
  it("maps Stripe statuses Grove stores", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("unpaid");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("incomplete")).toBeNull();
  });

  it("treats past_due as still Plus while Stripe retries the card", () => {
    expect(hasLivePlusSubscription("past_due")).toBe(true);
    expect(hasLivePlusSubscription("canceled")).toBe(false);
  });

  it("reads a Stripe id from a string or object", () => {
    expect(stripeObjectId("sub_123")).toBe("sub_123");
    expect(stripeObjectId({ id: "cus_123" })).toBe("cus_123");
    expect(stripeObjectId(null)).toBeNull();
  });
});
