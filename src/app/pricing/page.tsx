import type { Metadata } from "next";
import { PricingPage } from "@/features/marketing/pricing-page";
import { isStripeDonateConfigured } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Grove is free during open beta. Sign up now for a free-forever account when paid plans launch. Optional donations support development.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  return <PricingPage donationsReady={isStripeDonateConfigured()} />;
}
