import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  hasLivePlusSubscription,
  normalizeBillingState,
} from "@/features/billing/billing-state";
import {
  mapStripeSubscriptionStatus,
  stripeObjectId,
  syncStripeSubscription,
} from "@/features/billing/stripe-sync";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Checkout status · Grove",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { session_id: sessionId } = await searchParams;
  if (!user) {
    const next = sessionId
      ? `/checkout/success?session_id=${encodeURIComponent(sessionId)}`
      : "/checkout/success";
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const paymentsReady = isStripeConfigured();
  let plusReady = false;
  if (sessionId && paymentsReady) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      const sessionUser =
        session.client_reference_id || session.metadata?.user_id;
      if (sessionUser === user.id && session.mode === "subscription") {
        const subscriptionId = stripeObjectId(session.subscription);
        if (subscriptionId) {
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId);
          const status = mapStripeSubscriptionStatus(subscription.status);
          if (status) {
            await syncStripeSubscription({
              userId: user.id,
              customerId: stripeObjectId(subscription.customer),
              subscriptionId: subscription.id,
              status,
            });
            plusReady =
              status === "active" ||
              status === "trialing" ||
              status === "past_due";
          }
        }
      }
    } catch {
      plusReady = false;
    }
  }

  if (!plusReady) {
    const { data: rawBilling } = await supabase.rpc("get_my_billing_state");
    plusReady = hasLivePlusSubscription(
      normalizeBillingState(rawBilling).subscriptionStatus,
    );
  }

  return (
    <main className="billing-boundary-main">
      <section className="billing-boundary-card">
        <span className="eyebrow">CHECKOUT</span>
        <h1>
          {plusReady
            ? "Grove Plus is ready."
            : paymentsReady
              ? "We are confirming your payment."
              : "This site does not have Stripe keys yet."}
        </h1>
        <p>
          {plusReady
            ? "Unlimited stories, research, review, Ask AI, and manuscript export are on this account."
            : paymentsReady
              ? "If you completed payment, Grove Plus will appear on this account in a few seconds. You can also refresh Account & billing."
              : "The test payment may still have gone through in Stripe. Add the Stripe keys to this deployed site, then open Account & billing."}
        </p>
        <Link href="/dashboard" className="marketing-primary-cta">
          Return to your projects
        </Link>
      </section>
    </main>
  );
}
