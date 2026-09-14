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
          <span className="eyebrow">OPEN BETA</span>
          <h1>Sign up now. Stay free forever.</h1>
          <p>
            Grove is free during beta—every feature, every story. Accounts
            created now are part of the beta team and keep full access for
            life when Grove becomes a paid product. Optional donations support
            development.
          </p>
        </section>

        <section
          className="pricing-grid support-grid"
          aria-label="Grove beta and support"
        >
          <article className="pricing-card featured">
            <span className="eyebrow">BETA ACCESS</span>
            <h2>Free forever if you join now</h2>
            <p className="pricing-price">
              <strong>$0</strong>
              <span>for beta accounts</span>
            </p>
            <p className="pricing-description">
              No credit card. Full writing space today. Grandfathered free
              access when paid plans launch for new signups later.
            </p>
            <Link href="/sign-up" className="marketing-primary-cta">
              Join the beta
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
              Donations are optional and one-time. Your beta account stays free
              either way.
            </p>
            <DonateForm donationsReady={donationsReady} />
          </article>
        </section>

        <section className="pricing-assurance">
          <article>
            <h3>Beta means free forever for you.</h3>
            <p>
              Sign up during beta and Grove stamps your account. When paid
              plans open for new writers later, your access stays unlocked.
            </p>
          </article>
          <article>
            <h3>Your writing remains yours.</h3>
            <p>
              Grove never holds stories hostage. You can always read, copy,
              export, or delete your work.
            </p>
          </article>
          <article>
            <h3>Support is not a subscription.</h3>
            <p>
              A donation thanks the work behind Grove. It does not unlock
              features—beta accounts already have everything.
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
              <summary>Is Grove free right now?</summary>
              <p>
                Yes. During open beta every signed-in account can use the full
                writing space—unlimited stories, research, collaboration, Ask
                AI, and PDF export.
              </p>
            </details>
            <details>
              <summary>What does “free forever” mean?</summary>
              <p>
                If you create an account during beta, Grove marks you as a beta
                member. When Grove later charges new signups, your account
                keeps full access at no cost.
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
          <h2>Join the beta while it is open.</h2>
          <Link href="/sign-up" className="marketing-primary-cta">
            Start writing free
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    </MarketingShell>
  );
}
