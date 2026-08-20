import { ArrowRight, Check, CircleHelp, Sparkles } from "lucide-react";
import Link from "next/link";
import { MarketingShell } from "@/features/marketing/marketing-shell";

const FREE_FEATURES = [
  "1 story",
  "Up to 50 pages",
  "Writing editor and linked pages",
  "Dedicated script format",
  "Page types, aliases, and colored tags",
  "Timeline, relationship web, and family tree",
  "Project cover and night colors",
];

const PLUS_FEATURES = [
  "Unlimited stories",
  "Unlimited pages",
  "Everything in Grove Free",
  "Research workspace",
  "Invite reviewers or editors",
  "Page comments and text suggestions",
  "Ask AI with your own provider key",
  "Chapter and script PDF export",
  "Future premium planning tools",
];

export function PricingPage({
  paymentsReady = false,
}: {
  paymentsReady?: boolean;
}) {
  return (
    <MarketingShell>
      <main className="pricing-main">
        <section className="pricing-hero">
          <span className="eyebrow">SIMPLE PRICING</span>
          <h1>Start free. Grow when you are ready.</h1>
          <p>
            Build your first story without a credit card. Upgrade only when
            you need more room or deeper writing tools.
          </p>
        </section>

        {paymentsReady ? null : (
          <div className="pricing-preview-note">
            <Sparkles size={17} />
            <p>
              Grove Plus payments are not connected on this environment yet.
              Every feature remains available while billing keys are added.
            </p>
          </div>
        )}

        <section className="pricing-grid" aria-label="Grove plans">
          <article className="pricing-card">
            <span className="eyebrow">GROVE FREE</span>
            <h2>Begin your story</h2>
            <p className="pricing-price">
              <strong>$0</strong>
              <span>forever</span>
            </p>
            <p className="pricing-description">
              Enough room to discover whether Grove belongs in your writing
              life.
            </p>
            <Link href="/sign-up" className="marketing-secondary-cta">
              Start writing free
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

          <article className="pricing-card featured">
            <div className="pricing-card-topline">
              <span className="eyebrow">GROVE PLUS</span>
              {paymentsReady ? <small>MOST CHOSEN</small> : <small>COMING SOON</small>}
            </div>
            <h2>Let the whole world grow</h2>
            <p className="pricing-price">
              <strong>$9</strong>
              <span>/ month</span>
            </p>
            <p className="pricing-annual">or $90 billed yearly</p>
            <p className="pricing-description">
              For writers building longer manuscripts, larger worlds, and more
              than one story.
            </p>
            <Link
              href="/checkout?plan=plus"
              className="marketing-primary-cta"
            >
              {paymentsReady ? "Choose Grove Plus" : "View the Plus plan"}
              <ArrowRight size={16} />
            </Link>
            <ul>
              {PLUS_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="pricing-assurance">
          <article>
            <h3>Your writing remains yours.</h3>
            <p>
              If Plus ends, every story stays visible, readable, selectable,
              and copyable. Grove never deletes work because of a subscription
              change.
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
            <h3>Cancel without a maze.</h3>
            <p>
              Once payments are connected, billing and cancellation are
              available from Account &amp; billing.
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
              <summary>What counts as a page?</summary>
              <p>
                A page is any item you choose to create—a chapter, script,
                character, location, event, or note. Pages have no word limit, so one page
                can hold anything from a brief character detail to an entire
                manuscript. The Free limit measures how many separate pages
                you organize, not how much you can write.
              </p>
            </details>
            <details>
              <summary>Do I need a card for Grove Free?</summary>
              <p>No. Create an account and begin writing without a card.</p>
            </details>
            <details>
              <summary>Can I keep writing if I cancel Plus?</summary>
              <p>
                Yes. Choose one Active Free Story to keep editing; all other
                stories remain readable and copyable. Grove starts with your
                most recently edited story and gives you seven days to
                reconsider the choice. After that, you can change the active
                story once every 30 days. Restoring Plus immediately makes
                every story editable again.
              </p>
            </details>
            <details>
              <summary>Can I share a story with a beta reader or editor?</summary>
              <p>
                Yes. Grove Plus owners can send a private invite link. Reviewers
                can read, copy, comment, and suggest wording. Editors can also
                write. Grove keeps one person editing at a time so two drafts
                cannot overwrite each other.
              </p>
            </details>
            <details>
              <summary>How do I cancel Grove Plus?</summary>
              <p>
                Open Account &amp; billing and choose Manage billing. Stripe
                lets you update the card or cancel. If Plus ends, every story
                stays readable and copyable, and one Active Free Story remains
                editable.
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
