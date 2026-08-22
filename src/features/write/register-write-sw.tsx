"use client";

import { useEffect } from "react";

function collectPrecacheUrls() {
  const urls = new Set<string>();
  urls.add(window.location.href);
  urls.add(`${window.location.origin}/write`);

  for (const script of document.querySelectorAll("script[src]")) {
    const src = script.getAttribute("src");
    if (!src) continue;
    urls.add(new URL(src, window.location.origin).href);
  }

  for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
    const href = link.getAttribute("href");
    if (!href) continue;
    urls.add(new URL(href, window.location.origin).href);
  }

  return [...urls];
}

export function precacheWriteShellAssets() {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({
      type: "PRECACHE_URLS",
      urls: collectPrecacheUrls(),
    });
  });
}

export function RegisterWriteServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw-write.js", { scope: "/write/" })
      .then(() => precacheWriteShellAssets());
  }, []);
  return null;
}

export function CacheWorkspaceBridge(options: {
  workspaceId: string;
  workspaceName: string;
  userId?: string;
  pages: import("@/features/workspace/workspace").StoryPage[];
  enabled: boolean;
}) {
  useEffect(() => {
    if (!options.enabled || !options.userId) return;
    void import("@/features/write/offline-store").then(({ putCachedWorkspace, workspaceCacheSnapshot }) =>
      putCachedWorkspace(
        workspaceCacheSnapshot({
          id: options.workspaceId,
          name: options.workspaceName,
          userId: options.userId!,
          pages: options.pages,
          pendingSync: false,
        }),
      ),
    );
  }, [
    options.enabled,
    options.pages,
    options.userId,
    options.workspaceId,
    options.workspaceName,
  ]);
  return null;
}
