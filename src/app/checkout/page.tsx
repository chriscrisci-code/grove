import { ArrowLeft, BookOpen, Check, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketingShell } from "@/features/marketing/marketing-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Grove Plus",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
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

  return (
    <MarketingShell>
      <main className="billing-boundary-main">
        <section className="billing-boundary-card">
          <span className="billing-boundary-icon">
            <CreditCard size={24} />
          </span>
          <span className="eyebrow">GROVE PLUS</span>
          <h1>Everything is ready except the payment connection.</h1>
          <p>
            Grove Plus will be $9 per month or $90 per year. No payment has
            been collected, and every feature remains unlocked during the
            preview.
          </p>
          <div className="billing-plan-summary">
            <div>
              <span className="brand-mark">
                <BookOpen size={17} />
              </span>
              <div>
                <strong>Grove Plus</strong>
                <small>Payments coming soon</small>
              </div>
            </div>
            <b>$9 <small>/ month</small></b>
          </div>
          <ul>
            <li>
              <Check size={15} /> Unlimited stories and pages
            </li>
            <li>
              <Check size={15} /> Research and Ask AI
            </li>
            <li>
              <Check size={15} /> Chapter PDF export
            </li>
          </ul>
          <div className="onboarding-actions">
            <Link href="/pricing" className="marketing-secondary-cta">
              <ArrowLeft size={15} />
              Back to pricing
            </Link>
            <Link href="/onboarding" className="marketing-primary-cta">
              Continue to Grove
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
