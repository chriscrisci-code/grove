"use client";

import { useEffect, useState } from "react";
import { Workspace, type StoryPage } from "@/features/workspace/workspace";
import { createClient } from "@/lib/supabase/client";
import { checkGroveReachable, openFullGrove } from "@/features/write/connectivity";
import {
  getCachedWorkspace,
} from "@/features/write/offline-store";
import { refreshWorkspaceCacheFromCloud } from "@/features/write/offline-sync";
import { RegisterWriteServiceWorker } from "@/features/write/register-write-sw";
import { planAccessFromBilling } from "@/features/billing/plan";
import { normalizeBillingState } from "@/features/billing/billing-state";

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace(
          `/sign-in?next=${encodeURIComponent(`/write/${workspaceId}`)}`,
        );
        return;
      }
      const reachable = await checkGroveReachable();
      if (!active) return;
      setOnline(reachable);

      let snapshot = await getCachedWorkspace(workspaceId);
      if (reachable) {
        const { data: rawBilling } = await supabase.rpc("get_my_billing_state");
        setPlanAccess(
          planAccessFromBilling(normalizeBillingState(rawBilling).effectivePlan),
        );
        if (!snapshot || snapshot.userId !== user.id) {
          const refreshed = await refreshWorkspaceCacheFromCloud({
            supabase,
            workspaceId,
            userId: user.id,
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
            userId: user.id,
          }).then((refreshed) => {
            if (!active || !refreshed) return;
            setPages(refreshed.pages);
            setWorkspaceName(refreshed.name);
          });
        }
      } else if (!snapshot || snapshot.userId !== user.id) {
        setError(
          "This story is not on this device yet. Open it once in full Grove while online.",
        );
        setReady(true);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? undefined);
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
        <button
          type="button"
          className="marketing-primary-cta"
          onClick={() => openFullGrove("/dashboard")}
        >
          Open full Grove
        </button>
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
        <button type="button" onClick={() => openFullGrove(`/workspace/${workspaceId}`)}>
          Open in browser
        </button>
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
