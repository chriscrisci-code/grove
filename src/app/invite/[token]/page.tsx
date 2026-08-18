import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptance } from "@/features/collaboration/invite-acceptance";

export const metadata: Metadata = {
  title: "Story invitation · Grove",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: invite }, { data: auth }] = await Promise.all([
    supabase.rpc("peek_workspace_invite", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const details = invite as {
    valid?: boolean;
    workspaceName?: string;
    role?: "editor" | "viewer";
  } | null;

  if (!details?.valid || !details.workspaceName || !details.role) {
    return (
      <main className="invite-main">
        <section className="invite-card">
          <span className="eyebrow">GROVE INVITATION</span>
          <h1>This invitation is no longer available.</h1>
          <p>It may have expired, been revoked, or already been accepted.</p>
          <Link href="/" className="marketing-secondary-cta">
            Visit Grove
          </Link>
        </section>
      </main>
    );
  }

  return (
    <InviteAcceptance
      token={token}
      workspaceName={details.workspaceName}
      role={details.role}
      userEmail={auth.user?.email}
    />
  );
}
