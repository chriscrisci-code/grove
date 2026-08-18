import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/features/marketing/landing-page";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Grove · Keep your whole story connected",
  description:
    "Write chapters, keep a world bible, and draft in a dedicated script format. Grove connects pages, timelines, relationships, research, and review in one story workspace.",
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
