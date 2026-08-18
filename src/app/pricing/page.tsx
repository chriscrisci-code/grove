import type { Metadata } from "next";
import { PricingPage } from "@/features/marketing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing · Grove",
  description:
    "Start one story free, then grow into unlimited stories, research, Ask AI, and chapter PDF export with Grove Plus.",
};

export default function Pricing() {
  return <PricingPage />;
}
