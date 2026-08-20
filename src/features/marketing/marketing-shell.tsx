import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell">
      <div className="marketing-chrome">
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
              Sign up
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
