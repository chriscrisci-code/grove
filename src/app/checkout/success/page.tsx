import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  if (!user) redirect("/sign-in?next=/checkout/success");

  const { session_id: sessionId } = await searchParams;
  let plusReady = false;
  if (sessionId && isStripeConfigured()) {
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

  return (
    <main className="billing-boundary-main">
      <section className="billing-boundary-card">
        <span className="eyebrow">CHECKOUT</span>
        <h1>
          {plusReady
            ? "Grove Plus is ready."
            : isStripeConfigured()
              ? "We are confirming your payment."
              : "Payments are not connected yet."}
        </h1>
        <p>
          {plusReady
            ? "Unlimited stories, research, review, Ask AI, and manuscript export are on this account."
            : isStripeConfigured()
              ? "If you completed payment, Grove Plus will appear on this account in a few seconds. You can also refresh Account & billing."
              : "No charge was made. Add Stripe keys to Grove before subscribing."}
        </p>
        <Link href="/dashboard" className="marketing-primary-cta">
          Return to your projects
        </Link>
      </section>
    </main>
  );
}
