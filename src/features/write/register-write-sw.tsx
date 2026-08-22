"use client";

import { useEffect } from "react";

export function RegisterWriteServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw-write.js", { scope: "/write/" });
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
