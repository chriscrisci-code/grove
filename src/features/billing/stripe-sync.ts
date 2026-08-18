import type { SubscriptionStatus } from "./billing-state";
import { createAdminClient } from "../../lib/supabase/admin";

export {
  mapStripeSubscriptionStatus,
  stripeObjectId,
} from "./stripe-status";

export async function syncStripeSubscription(options: {
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status: SubscriptionStatus;
}) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("sync_stripe_subscription", {
    check_user_id: options.userId,
    customer_id: options.customerId ?? "",
    subscription_id: options.subscriptionId ?? "",
    status: options.status,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function userIdForStripeCustomer(customerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_billing")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.user_id === "string" ? data.user_id : null;
}

export async function recordStripeWebhookEvent(
  eventId: string,
  eventType: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}
