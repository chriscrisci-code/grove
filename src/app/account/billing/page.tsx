import { ArrowLeft, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeBillingState } from "@/features/billing/billing-state";
import { DeleteAccountButton } from "@/features/billing/delete-account-button";

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
  const { data: activeWorkspace } = billing.activeWorkspaceId
    ? await supabase
        .from("workspaces")
        .select("name")
        .eq("id", billing.activeWorkspaceId)
        .maybeSingle()
    : { data: null };

  return (
    <main className="billing-boundary-main">
      <section className="billing-boundary-card">
        <span className="billing-boundary-icon">
          <CreditCard size={24} />
        </span>
        <span className="eyebrow">ACCOUNT &amp; BILLING</span>
        <h1>
          {billing.previewMode ? "Grove preview access" : "Your Grove plan"}
        </h1>
        <p>
          Signed in as <strong>{user.email}</strong>.{" "}
          {billing.previewMode
            ? "Billing is not connected yet, so every Grove feature remains available while payment support is prepared."
            : "Manage your plan and which story stays editable on Grove Free."}
        </p>
        <div className="billing-plan-summary">
          <div>
            <span className="billing-status-dot" />
            <div>
              <strong>
                {billing.previewMode
                  ? "Preview access"
                  : billing.effectivePlan === "plus"
                    ? "Grove Plus"
                    : "Grove Free"}
              </strong>
              <small>
                {billing.previewMode
                  ? "No active subscription or payment method"
                  : billing.effectivePlan === "plus"
                    ? "Every story is editable"
                    : `Active Free Story: ${activeWorkspace?.name ?? "your most recently edited story"}`}
              </small>
            </div>
          </div>
        </div>
        <div className="billing-access-policy">
          <strong>Your writing is never held hostage.</strong>
          <p>
            If Plus ends, every story stays visible, readable, selectable, and
            copyable. One Active Free Story remains editable; the others become
            read-only until Plus is restored. You can choose a different Active
            Free Story during a seven-day selection grace period, then once
            every 30 days. You can always delete a story or your account
            intentionally. Grove Plus also lets you invite reviewers and
            editors without giving up ownership of the work.
          </p>
        </div>
        <div className="onboarding-actions">
          <Link href="/dashboard" className="marketing-secondary-cta">
            <ArrowLeft size={15} />
            Your projects
          </Link>
          <Link href="/pricing" className="marketing-primary-cta">
            Compare plans
          </Link>
        </div>
        <div className="billing-danger-zone">
          <div>
            <strong>Delete account</strong>
            <p>
              This is always your choice. It permanently removes every story
              and cannot be undone.
            </p>
          </div>
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}
