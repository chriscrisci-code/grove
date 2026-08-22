import type { Metadata, Viewport } from "next";
import { WriteShell } from "@/features/write/write-shell";

export const metadata: Metadata = {
  title: "Grove Write",
  description:
    "Write and organize your Grove stories offline. Open full Grove in the browser for everything else.",
  robots: { index: false, follow: false },
  manifest: "/write-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Grove Write",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f4a37",
};

export default function WritePage() {
  return <WriteShell />;
}
