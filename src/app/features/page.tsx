import type { Metadata } from "next";
import { FeaturesPage } from "@/features/marketing/features-page";

export const metadata: Metadata = {
  title: "Features · Grove",
  description:
    "Write chapters, keep a world bible, and draft in a dedicated script format. Grove connects pages, timelines, relationships, research, and review in one story workspace.",
};

export default function Features() {
  return <FeaturesPage />;
}
