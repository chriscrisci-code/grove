import type { Metadata } from "next";
import { Workspace } from "@/features/workspace/workspace";

export const metadata: Metadata = {
  title: "Try Grove",
  description: "Explore a local Grove writing workspace without an account.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <Workspace workspaceName="Grove Demo" />;
}
