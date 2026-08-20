import type { Metadata } from "next";
import { PricingPage } from "@/features/marketing/pricing-page";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Grove Free includes one story. Grove Plus adds unlimited stories, research, review, Ask AI, and manuscript PDF export.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  return <PricingPage paymentsReady={isStripeConfigured()} />;
}
