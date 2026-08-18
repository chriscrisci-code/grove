import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Checkout status · Grove",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage() {
  return (
    <main className="billing-boundary-main">
      <section className="billing-boundary-card">
        <span className="eyebrow">CHECKOUT</span>
        <h1>Payments are not connected yet.</h1>
        <p>
          No charge was made. This page is reserved for the confirmation flow
          that will be activated when Grove connects its payment provider.
        </p>
        <Link href="/dashboard" className="marketing-primary-cta">
          Return to your projects
        </Link>
      </section>
    </main>
  );
}
