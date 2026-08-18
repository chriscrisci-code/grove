import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function MarketingShell({
  children,
  showBetaBanner = true,
}: {
  children: ReactNode;
  showBetaBanner?: boolean;
}) {
  return (
    <div className="marketing-shell">
      <div className="marketing-chrome">
        {showBetaBanner ? (
          <p className="marketing-beta-banner">
            <span>Coming soon · Beta test for free</span>
            <Link href="/sign-up">Sign up</Link>
          </p>
        ) : null}
        <header className="marketing-nav">
          <Link href="/" className="marketing-brand" aria-label="Grove home">
            <span className="brand-mark">
              <BookOpen size={18} />
            </span>
            Grove
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up" className="marketing-nav-cta">
              Join the beta
            </Link>
          </nav>
        </header>
      </div>
      {children}
      <footer className="marketing-footer">
        <Link href="/" className="marketing-brand">
          <span className="brand-mark">
            <BookOpen size={16} />
          </span>
          Grove
        </Link>
        <p>A connected writing space for stories, worlds, and scripts.</p>
        <nav aria-label="Footer navigation">
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/demo">Try the demo</Link>
        </nav>
        <small>© {new Date().getFullYear()} Grove</small>
      </footer>
    </div>
  );
}
