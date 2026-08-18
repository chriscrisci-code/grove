import type Stripe from "stripe";
import {
  mapStripeSubscriptionStatus,
  recordStripeWebhookEvent,
  stripeObjectId,
  syncStripeSubscription,
  userIdForStripeCustomer,
} from "@/features/billing/stripe-sync";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function userIdFromStripe(options: {
  userId?: string | null;
  customerId?: string | null;
}) {
  if (options.userId) return options.userId;
  if (options.customerId) return userIdForStripeCustomer(options.customerId);
  return null;
}

async function syncFromSubscription(subscription: Stripe.Subscription) {
  const status = mapStripeSubscriptionStatus(subscription.status);
  if (!status) return;
  const customerId = stripeObjectId(subscription.customer);
  const userId = await userIdFromStripe({
    userId: subscription.metadata?.user_id,
    customerId,
  });
  if (!userId) return;
  await syncStripeSubscription({
    userId,
    customerId,
    subscriptionId: subscription.id,
    status,
  });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      const subscriptionId = stripeObjectId(session.subscription);
      if (!subscriptionId) return;
      const subscription = await getStripe().subscriptions.retrieve(
        subscriptionId,
      );
      if (!subscription.metadata?.user_id && session.metadata?.user_id) {
        await getStripe().subscriptions.update(subscriptionId, {
          metadata: { user_id: session.metadata.user_id },
        });
        subscription.metadata = {
          ...subscription.metadata,
          user_id: session.metadata.user_id,
        };
      }
      await syncFromSubscription(subscription);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncFromSubscription(event.data.object as Stripe.Subscription);
      return;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeObjectId(
        invoice.parent?.subscription_details?.subscription,
      );
      if (!subscriptionId) return;
      const subscription =
        await getStripe().subscriptions.retrieve(subscriptionId);
      await syncFromSubscription(subscription);
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return new Response("Webhook is not configured.", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  await handleStripeEvent(event);
  await recordStripeWebhookEvent(event.id, event.type);
  return new Response(null, { status: 200 });
}
