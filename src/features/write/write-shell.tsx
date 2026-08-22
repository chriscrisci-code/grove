"use client";

import { ExternalLink, PenLine, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkGroveReachable, openFullGrove } from "@/features/write/connectivity";
import {
  listCachedWorkspaces,
  type CachedWorkspace,
} from "@/features/write/offline-store";
import { syncPendingCachedWorkspaces } from "@/features/write/offline-sync";
import { RegisterWriteServiceWorker } from "@/features/write/register-write-sw";
import { AddToHomeScreenButton } from "@/features/write/add-to-home-screen";

export function WriteShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [stories, setStories] = useState<CachedWorkspace[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadStories(activeUserId: string) {
    setStories(await listCachedWorkspaces(activeUserId));
  }

  async function refreshReachability() {
    setOnline(await checkGroveReachable());
  }

  useEffect(() => {
    let active = true;
    async function boot() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        window.location.replace(
          `/sign-in?next=${encodeURIComponent("/write")}`,
        );
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);
      await refreshReachability();
      await loadStories(user.id);
      if (await checkGroveReachable()) {
        setSyncing(true);
        const results = await syncPendingCachedWorkspaces({
          supabase,
          userId: user.id,
        });
        const failed = results.filter((item) => !item.result.ok);
        if (failed.length > 0) {
          setNotice(
            failed.length === 1
              ? "One story still needs to sync when editing is free."
              : `${failed.length} stories still need to sync when editing is free.`,
          );
        }
        await loadStories(user.id);
        setSyncing(false);
      }
      setLoading(false);
    }
    void boot();
    const onOnline = () => void refreshReachability();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <>
      <RegisterWriteServiceWorker />
      <main className="write-shell">
        <header className="write-shell-header">
          <div className="write-shell-brand">
            <PenLine size={22} />
            <div>
              <span className="eyebrow">GROVE WRITE</span>
              <h1>Write anywhere</h1>
            </div>
          </div>
          <div className="write-shell-status">
            <span className={`write-shell-pill ${online ? "online" : "offline"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online ? "Online" : "Offline"}
            </span>
            {userEmail && <small>{userEmail}</small>}
          </div>
        </header>

        <section className="write-shell-card">
          <p>
            Grove Write keeps your manuscript on this device for writing, page
            order, and PDF export. Open full Grove in the browser for tags,
            research, AI, collaboration, and billing.
          </p>
          <div className="write-shell-actions">
            <AddToHomeScreenButton />
            <button
              type="button"
              className="marketing-primary-cta"
              onClick={() => openFullGrove("/dashboard")}
            >
              <ExternalLink size={15} />
              Open full Grove
            </button>
            <Link href="/account/billing" className="secondary-button">
              Account
            </Link>
          </div>
        </section>

        <section className="write-shell-card">
          <div className="write-shell-list-heading">
            <h2>Stories on this device</h2>
            {syncing && <small>Syncing…</small>}
          </div>
          {notice && <p className="write-shell-notice">{notice}</p>}
          {loading ? (
            <p>Loading cached stories…</p>
          ) : stories.length === 0 ? (
            <div className="write-shell-empty">
              <p>No stories are cached here yet.</p>
              <p>
                Open a story in full Grove while online once. Grove Write will
                keep a copy for offline writing.
              </p>
              {online && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openFullGrove("/dashboard")}
                >
                  Open full Grove
                </button>
              )}
            </div>
          ) : (
            <ul className="write-shell-story-list">
              {stories.map((story) => (
                <li key={story.id}>
                  <Link href={`/write/${story.id}`} className="write-shell-story">
                    <strong>{story.name}</strong>
                    <span>
                      {story.pendingSync
                        ? "Waiting to sync"
                        : `Cached ${new Date(story.cachedAt).toLocaleString()}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!online && userId && stories.length > 0 && (
          <p className="write-shell-footnote">
            You are offline. Changes stay on this device until Grove is reachable
            again.
          </p>
        )}
      </main>
    </>
  );
}
