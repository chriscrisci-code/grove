import { ArrowRight, Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/features/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default function DonateSuccessPage() {
  return (
    <MarketingShell>
      <main className="pricing-main donate-success-main">
        <section className="pricing-hero">
          <span className="billing-boundary-icon" aria-hidden="true">
            <Heart size={24} />
          </span>
          <span className="eyebrow">THANK YOU</span>
          <h1>Your support helps Grove grow.</h1>
          <p>
            Donations keep development moving. Grove stays free for every
            writer—go plant another page.
          </p>
          <div className="marketing-cta-row" style={{ justifyContent: "center" }}>
            <Link href="/dashboard" className="marketing-primary-cta">
              Your projects
              <ArrowRight size={16} />
            </Link>
            <Link href="/" className="marketing-secondary-cta">
              Back home
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
