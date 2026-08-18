import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set up your first story · Grove",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/demo");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-up");

  const { data: existingStory } = await supabase
    .from("workspaces")
    .select("id,name,description,genre")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return <OnboardingWizard existingStory={existingStory} />;
}
