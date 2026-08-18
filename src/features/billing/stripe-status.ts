import type { SubscriptionStatus } from "./billing-state";

export function mapStripeSubscriptionStatus(
  status: string,
): SubscriptionStatus | null {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
      return status;
    case "incomplete_expired":
      return "canceled";
    default:
      return null;
  }
}

export function stripeObjectId(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return null;
}
