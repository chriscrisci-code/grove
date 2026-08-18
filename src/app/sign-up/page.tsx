import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/features/auth/auth-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create your account · Grove",
  description: "Start one connected story free with Grove.",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
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
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/onboarding";
  if (user) redirect(nextPath);

  return <AuthScreen mode="signup" nextPath={nextPath} />;
}
