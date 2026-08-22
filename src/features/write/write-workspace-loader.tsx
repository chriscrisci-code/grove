"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Workspace, type StoryPage } from "@/features/workspace/workspace";
import { createClient } from "@/lib/supabase/client";
import { checkGroveReachable, openFullGrove } from "@/features/write/connectivity";
import { getCachedWorkspace } from "@/features/write/offline-store";
import { refreshWorkspaceCacheFromCloud } from "@/features/write/offline-sync";
import {
  precacheWriteShellAssets,
  RegisterWriteServiceWorker,
} from "@/features/write/register-write-sw";
import { planAccessFromBilling } from "@/features/billing/plan";
import { normalizeBillingState } from "@/features/billing/billing-state";
import {
  persistLastWriteWorkspace,
  resolveWriteSession,
} from "@/features/write/write-session";

type WriteWorkspaceLoaderProps = {
  workspaceId: string;
};

export function WriteWorkspaceLoader({ workspaceId }: WriteWorkspaceLoaderProps) {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [workspaceName, setWorkspaceName] = useState("My Story");
  const [userId, setUserId] = useState<string | undefined>();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [planAccess, setPlanAccess] = useState(
    planAccessFromBilling("plus"),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const sessionResult = await resolveWriteSession(supabase);
      if (!active) return;

      if (sessionResult.status === "needs-sign-in") {
        window.location.replace(
          `/sign-in?next=${encodeURIComponent(`/write/${workspaceId}`)}`,
        );
        return;
      }

      if (sessionResult.status === "offline-no-session") {
        setError(
          "Sign in to Grove Write once while online. After that, cached stories open offline from this device.",
        );
        setReady(true);
        return;
      }

      const session = sessionResult.session;
      persistLastWriteWorkspace(workspaceId);
      precacheWriteShellAssets();

      const reachable = await checkGroveReachable();
      if (!active) return;
      setOnline(reachable);

      let snapshot = await getCachedWorkspace(workspaceId);
      if (reachable) {
        const { data: rawBilling } = await supabase.rpc("get_my_billing_state");
        setPlanAccess(
          planAccessFromBilling(normalizeBillingState(rawBilling).effectivePlan),
        );
        if (!snapshot || snapshot.userId !== session.userId) {
          const refreshed = await refreshWorkspaceCacheFromCloud({
            supabase,
            workspaceId,
            userId: session.userId,
          });
          if (!refreshed) {
            setError("This story was not found in your Grove account.");
            setReady(true);
            return;
          }
          snapshot = refreshed;
        } else if (!snapshot.pendingSync) {
          void refreshWorkspaceCacheFromCloud({
            supabase,
            workspaceId,
            userId: session.userId,
          }).then((refreshed) => {
            if (!active || !refreshed) return;
            setPages(refreshed.pages);
            setWorkspaceName(refreshed.name);
          });
        }
      } else if (!snapshot || snapshot.userId !== session.userId) {
        setError(
          "This story is not on this device yet. Open it once in Grove Write or full Grove while online.",
        );
        setReady(true);
        return;
      }

      setUserId(session.userId);
      setUserEmail(session.email ?? undefined);
      setPages(snapshot.pages);
      setWorkspaceName(snapshot.name);
      setReady(true);
    }
    void load();
    const refreshOnline = () => void checkGroveReachable().then(setOnline);
    window.addEventListener("online", refreshOnline);
    window.addEventListener("offline", () => setOnline(false));
    return () => {
      active = false;
      window.removeEventListener("online", refreshOnline);
      window.removeEventListener("offline", () => setOnline(false));
    };
  }, [workspaceId]);

  if (!ready) {
    return (
      <main className="write-shell write-shell-loading">
        <RegisterWriteServiceWorker />
        <p>Opening Grove Write…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="write-shell write-shell-loading">
        <RegisterWriteServiceWorker />
        <p>{error}</p>
        {!online && (
          <Link href="/write" className="secondary-button">
            Back to stories on this device
          </Link>
        )}
        {online && (
          <button
            type="button"
            className="marketing-primary-cta"
            onClick={() => openFullGrove("/dashboard")}
          >
            Open full Grove
          </button>
        )}
      </main>
    );
  }

  return (
    <>
      <RegisterWriteServiceWorker />
      <div className="write-shell-banner" role="status">
        <span>
          {online
            ? "Grove Write — changes save here and sync to Grove when they can."
            : "Offline — writing and page order stay on this device until Grove is back."}
        </span>
        {online && (
          <button type="button" onClick={() => openFullGrove(`/workspace/${workspaceId}`)}>
            Open in browser
          </button>
        )}
      </div>
      <Workspace
        initialCloudPages={pages}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        userId={userId}
        userEmail={userEmail}
        planAccess={planAccess}
        writeShell
        writeShellOnline={online}
      />
    </>
  );
}
