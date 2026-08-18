"use client";

import { BookOpen, LoaderCircle, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function InviteAcceptance({
  token,
  workspaceName,
  role,
  userEmail,
}: {
  token: string;
  workspaceName: string;
  role: "editor" | "viewer";
  userEmail?: string;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const next = `/invite/${token}`;

  async function accept() {
    setAccepting(true);
    setError("");
    const { data, error: acceptError } = await createClient().rpc(
      "accept_workspace_invite",
      { p_token: token },
    );
    setAccepting(false);
    if (acceptError || !data) {
      setError(acceptError?.message || "The invitation could not be accepted.");
      return;
    }
    const result = data as { workspaceId?: string };
    if (!result.workspaceId) {
      setError("The invitation could not be accepted.");
      return;
    }
    router.replace(`/workspace/${result.workspaceId}`);
    router.refresh();
  }

  return (
    <main className="invite-main">
      <section className="invite-card">
        <span className="invite-icon">
          <UserRoundCheck size={24} />
        </span>
        <span className="eyebrow">GROVE INVITATION</span>
        <h1>Join “{workspaceName}”</h1>
        <p>
          You have been invited as a{" "}
          <strong>{role === "viewer" ? "Reviewer" : "Editor"}</strong>.
        </p>
        <div className="invite-role-summary">
          <BookOpen size={17} />
          {role === "viewer"
            ? "Read the story, select and copy text, and leave comments or suggestions."
            : "Write and organize the story, and participate in comments and suggestions."}
        </div>
        {userEmail ? (
          <>
            <small>Signed in as {userEmail}</small>
            <button
              type="button"
              className="marketing-primary-cta"
              disabled={accepting}
              onClick={() => void accept()}
            >
              {accepting && <LoaderCircle className="spin" size={15} />}
              {accepting ? "Joining…" : "Accept invitation"}
            </button>
          </>
        ) : (
          <div className="invite-actions">
            <Link
              href={`/sign-in?next=${encodeURIComponent(next)}`}
              className="marketing-primary-cta"
            >
              Sign in to accept
            </Link>
            <Link
              href={`/sign-up?next=${encodeURIComponent(next)}`}
              className="marketing-secondary-cta"
            >
              Create an account
            </Link>
          </div>
        )}
        {error && <p className="invite-error">{error}</p>}
        <small>
          Sign in using the same email address that received this invitation.
        </small>
      </section>
    </main>
  );
}
