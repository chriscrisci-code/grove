import type { Metadata } from "next";
import { FeaturesPage } from "@/features/marketing/features-page";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Grove features for long fiction: chapters, script format, linked world pages, timeline, relationships, research, and review. Free to start.",
  alternates: { canonical: "/features" },
};

export default function Features() {
  return <FeaturesPage />;
}
