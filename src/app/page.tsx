import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/features/marketing/landing-page";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Keep your whole story connected",
  description:
    "Coming soon. Grove is in open beta: write chapters, keep a world bible, and draft in script format. Sign up and test it for free.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Grove · Keep your whole story connected",
    description:
      "Coming soon. Open beta is free. Write chapters, keep a world bible, and draft in a dedicated script format.",
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
