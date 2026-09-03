import { ArrowRight, Check, CircleHelp, Heart } from "lucide-react";
import Link from "next/link";
import { DonateForm } from "@/features/billing/donate-form";
import { MarketingShell } from "@/features/marketing/marketing-shell";

const FREE_FEATURES = [
  "Unlimited stories and pages",
  "Writing editor and linked pages",
  "Dedicated script format",
  "Chapters, Events, Scripts, and Script events",
  "Page types, aliases, and colored tags",
  "Timeline, relationship web, and family tree",
  "Research workspace",
  "Invite reviewers or editors",
  "Ask AI with your own provider key",
  "Chapter and script PDF export",
  "Project covers and night colors",
];

export function PricingPage({
  donationsReady = false,
}: {
  donationsReady?: boolean;
}) {
  return (
    <MarketingShell>
      <main className="pricing-main">
        <section className="pricing-hero">
          <span className="eyebrow">FREE FOR EVERYONE</span>
          <h1>Grove is free. Write without a paywall.</h1>
          <p>
            Every feature is available on every account. If Grove helps your
            stories grow and you want to support development, you can donate
            below—optional, one time, no subscription.
          </p>
        </section>

        <section className="pricing-grid support-grid" aria-label="Grove is free">
          <article className="pricing-card featured">
            <span className="eyebrow">GROVE</span>
            <h2>Everything included</h2>
            <p className="pricing-price">
              <strong>$0</strong>
              <span>for everyone</span>
            </p>
            <p className="pricing-description">
              No story limits, no locked tools, no credit card to start.
            </p>
            <Link href="/sign-up" className="marketing-primary-cta">
              Start writing free
              <ArrowRight size={16} />
            </Link>
            <ul>
              {FREE_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  {feature}
                </li>
              ))}
            </ul>
          </article>

          <article className="pricing-card donate-card">
            <div className="pricing-card-topline">
              <span className="eyebrow">SUPPORT GROVE</span>
              <Heart size={16} aria-hidden="true" />
            </div>
            <h2>Help keep development going</h2>
            <p className="pricing-description">
              Donations are optional and one-time. Grove stays free either way.
            </p>
            <DonateForm donationsReady={donationsReady} />
          </article>
        </section>

        <section className="pricing-assurance">
          <article>
            <h3>Your writing remains yours.</h3>
            <p>
              Grove never holds stories hostage. You can always read, copy,
              export, or delete your work.
            </p>
          </article>
          <article>
            <h3>AI stays optional.</h3>
            <p>
              Grove connects to an AI provider key you control. The editor,
              story organization, and relationships work without it.
            </p>
          </article>
          <article>
            <h3>Support is not a subscription.</h3>
            <p>
              A donation thanks the work behind Grove. It does not unlock
              features—those are already free.
            </p>
          </article>
        </section>

        <section className="pricing-faq">
          <div className="marketing-section-heading">
            <div>
              <span className="eyebrow">QUESTIONS</span>
              <h2>Before you plant the first page.</h2>
            </div>
            <CircleHelp size={26} />
          </div>
          <div>
            <details>
              <summary>Is Grove really free?</summary>
              <p>
                Yes. Pay tiers are suspended. Every signed-in account can use
                the full writing space, including unlimited stories, research,
                collaboration, Ask AI, and PDF export.
              </p>
            </details>
            <details>
              <summary>Do I need a card to write?</summary>
              <p>No. Create an account and begin writing without a card.</p>
            </details>
            <details>
              <summary>What does a donation pay for?</summary>
              <p>
                Hosting, tools, and time to keep improving Grove. It is
                optional gratitude, not a plan upgrade.
              </p>
            </details>
            <details>
              <summary>Can I share a story with a beta reader or editor?</summary>
              <p>
                Yes. Send a private invite link. Reviewers can read, copy,
                comment, and suggest wording. Editors can also write. Grove
                keeps one person editing at a time so two drafts cannot
                overwrite each other.
              </p>
            </details>
            <details>
              <summary>Does Ask AI include AI usage fees?</summary>
              <p>
                Grove currently connects to your own OpenAI, Anthropic, or
                Google key, so provider usage is billed by that provider.
              </p>
            </details>
          </div>
        </section>

        <section className="marketing-final-cta pricing-bottom-cta">
          <span className="eyebrow">NO CARD REQUIRED</span>
          <h2>Start with the story already asking to be written.</h2>
          <Link href="/sign-up" className="marketing-primary-cta">
            Start writing
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    </MarketingShell>
  );
}
