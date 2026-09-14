import { ArrowLeft, CreditCard, Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  hasLivePlusSubscription,
  normalizeBillingState,
} from "@/features/billing/billing-state";
import { DeleteAccountButton } from "@/features/billing/delete-account-button";
import { ManageBillingButton } from "@/features/billing/manage-billing-button";
import { PAY_TIERS_SUSPENDED } from "@/features/billing/plan";
import { isStripeDonateConfigured } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Billing · Grove",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
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
  if (!user) redirect("/sign-in?next=/account/billing");
  const { data: rawBilling } = await supabase.rpc("get_my_billing_state");
  const billing = normalizeBillingState(rawBilling);
  const donationsReady = isStripeDonateConfigured();
  const subscribed = hasLivePlusSubscription(billing.subscriptionStatus);
  const betaForever = billing.betaForever || PAY_TIERS_SUSPENDED;

  return (
    <main className="billing-boundary-main">
      <section className="billing-boundary-card">
        <span className="billing-boundary-icon">
          <CreditCard size={24} />
        </span>
        <span className="eyebrow">ACCOUNT &amp; BILLING</span>
        <h1>{betaForever ? "Beta · free forever" : "Your Grove plan"}</h1>
        <p>
          Signed in as <strong>{user.email}</strong>.{" "}
          {betaForever
            ? "You joined during Grove beta, so this account keeps full access forever—even after Grove becomes a paid product."
            : "Manage your plan and which story stays editable on Grove Free."}
        </p>
        <div className="billing-plan-summary">
          <div>
            <span className="billing-status-dot" />
            <div>
              <strong>
                {betaForever
                  ? "Beta · free forever"
                  : subscribed
                    ? "Grove Plus"
                    : "Grove Free"}
              </strong>
              <small>
                {betaForever
                  ? "Unlimited stories, research, collaboration, Ask AI, and PDF export."
                  : subscribed
                    ? "Every story is editable"
                    : "Active Free Story limits apply"}
              </small>
            </div>
          </div>
        </div>
        <div className="billing-access-policy">
          <strong>Your writing is never held hostage.</strong>
          <p>
            You can always read, copy, export, or delete your work. Optional
            one-time donations on the Support page help fund development—they
            are never required to keep writing.
          </p>
        </div>
        <div className="onboarding-actions">
          <Link href="/dashboard" className="marketing-secondary-cta">
            <ArrowLeft size={15} />
            Your projects
          </Link>
          {subscribed && billing.hasStripeCustomer ? (
            <ManageBillingButton />
          ) : null}
          <Link href="/pricing" className="marketing-primary-cta">
            <Heart size={15} />
            {donationsReady ? "Support Grove" : "About supporting Grove"}
          </Link>
        </div>
        <div className="billing-danger-zone">
          <div>
            <strong>Delete account</strong>
            <p>
              This is always your choice. It permanently removes every story
              and cannot be undone.
              {subscribed
                ? " An active Grove Plus subscription is canceled first."
                : ""}
            </p>
          </div>
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}
