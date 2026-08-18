import { ArrowLeft, BookOpen, Check, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/features/billing/checkout-form";
import { ManageBillingButton } from "@/features/billing/manage-billing-button";
import {
  hasLivePlusSubscription,
  type SubscriptionStatus,
} from "@/features/billing/billing-state";
import { MarketingShell } from "@/features/marketing/marketing-shell";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Grove Plus",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/demo");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-up?next=%2Fcheckout%3Fplan%3Dplus");
  }

  const { interval: intervalParam } = await searchParams;
  const defaultInterval = intervalParam === "year" ? "year" : "month";
  const paymentsReady = isStripeConfigured();
  const { data: billing } = await supabase
    .from("user_billing")
    .select("subscription_status,stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const subscribed = hasLivePlusSubscription(
    (billing?.subscription_status ?? "none") as SubscriptionStatus,
  );

  return (
    <MarketingShell showBetaBanner={false}>
      <main className="billing-boundary-main">
        <section className="billing-boundary-card">
          <span className="billing-boundary-icon">
            <CreditCard size={24} />
          </span>
          <span className="eyebrow">GROVE PLUS</span>
          <h1>
            {subscribed
              ? "Grove Plus is already on this account."
              : paymentsReady
                ? "Choose monthly or yearly, then continue to Stripe."
                : "Everything is ready except the payment connection."}
          </h1>
          <p>
            {subscribed
              ? "Manage your payment method, invoices, or cancellation from the Stripe billing portal."
              : paymentsReady
                ? "Grove Plus is $9 per month or $90 per year. You will confirm the charge on Stripe’s checkout page."
                : "Grove Plus will be $9 per month or $90 per year. Add Stripe keys to Grove, then return here to subscribe."}
          </p>
          <div className="billing-plan-summary">
            <div>
              <span className="brand-mark">
                <BookOpen size={17} />
              </span>
              <div>
                <strong>Grove Plus</strong>
                <small>
                  {subscribed
                    ? "Active subscription"
                    : paymentsReady
                      ? defaultInterval === "year"
                        ? "$90 billed yearly"
                        : "$9 billed monthly"
                      : "Payments not configured yet"}
                </small>
              </div>
            </div>
            <b>
              {defaultInterval === "year" ? "$90" : "$9"}{" "}
              <small>{defaultInterval === "year" ? "/ year" : "/ month"}</small>
            </b>
          </div>
          <ul>
            <li>
              <Check size={15} /> Unlimited stories and pages
            </li>
            <li>
              <Check size={15} /> Research and Ask AI
            </li>
            <li>
              <Check size={15} /> Chapter and script PDF export
            </li>
          </ul>
          {subscribed && billing?.stripe_customer_id ? (
            <div className="onboarding-actions">
              <Link href="/account/billing" className="marketing-secondary-cta">
                <ArrowLeft size={15} />
                Account &amp; billing
              </Link>
              <ManageBillingButton />
            </div>
          ) : paymentsReady ? (
            <>
              <CheckoutForm defaultInterval={defaultInterval} />
              <div className="onboarding-actions">
                <Link href="/pricing" className="marketing-secondary-cta">
                  <ArrowLeft size={15} />
                  Back to pricing
                </Link>
              </div>
            </>
          ) : (
            <div className="onboarding-actions">
              <Link href="/pricing" className="marketing-secondary-cta">
                <ArrowLeft size={15} />
                Back to pricing
              </Link>
              <Link href="/onboarding" className="marketing-primary-cta">
                Continue to Grove
              </Link>
            </div>
          )}
        </section>
      </main>
    </MarketingShell>
  );
}
