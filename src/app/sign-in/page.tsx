import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/features/auth/auth-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in · Grove",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; authError?: string }>;
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
      : "/dashboard";
  if (user) redirect(nextPath);

  return (
    <AuthScreen
      mode="signin"
      nextPath={nextPath}
      initialMessage={params.authError ?? ""}
    />
  );
}
