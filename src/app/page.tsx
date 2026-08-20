import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/features/marketing/landing-page";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Keep your whole story connected",
  description:
    "Grove is a connected writing space: write chapters, keep a world bible, and draft in script format. Free to start.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Grove · Keep your whole story connected",
    description:
      "Write chapters, keep a world bible, and draft in a dedicated script format. Free to start.",
    url: "/",
  },
};

export default async function Home() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }
  return <LandingPage />;
}
