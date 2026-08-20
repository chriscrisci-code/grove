import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GROVE_FEATURES } from "@/features/marketing/grove-features";
import { MarketingShell } from "@/features/marketing/marketing-shell";

export function FeaturesPage() {
  return (
    <MarketingShell>
      <main className="features-main">
        <section className="pricing-hero">
          <span className="eyebrow">WHAT GROVE INCLUDES</span>
          <h1>The page, the world, and a script format in one place.</h1>
          <p>
            Grove is a writing space for long stories. Draft chapters, keep
            the bible beside them, and open a Script page when the work needs
            to look like a screenplay.
          </p>
        </section>

        <section className="features-detail-grid" aria-label="Grove features">
          {GROVE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="features-detail-card">
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.detail}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="marketing-final-cta pricing-bottom-cta">
          <span className="eyebrow">START WITH GROVE FREE</span>
          <h2>Sign up and start writing.</h2>
          <div className="marketing-cta-row">
            <Link href="/sign-up" className="marketing-primary-cta">
              Start writing
              <ArrowRight size={17} />
            </Link>
            <Link href="/pricing" className="marketing-secondary-cta">
              See pricing
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
