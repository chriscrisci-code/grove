import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/features/marketing/landing-page";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Grove · Keep your whole story connected",
  description:
    "Write chapters while organizing characters, places, timelines, relationships, research, and ideas in one connected story workspace.",
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
