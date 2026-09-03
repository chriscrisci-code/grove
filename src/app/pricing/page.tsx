import type { Metadata } from "next";
import { PricingPage } from "@/features/marketing/pricing-page";
import { isStripeDonateConfigured } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Grove is free for everyone—unlimited stories, research, collaboration, Ask AI, and PDF export. Optional donations support development.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  return <PricingPage donationsReady={isStripeDonateConfigured()} />;
}
