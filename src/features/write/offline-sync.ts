import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoryPage } from "@/features/workspace/workspace";
import {
  getCachedWorkspace,
  markWorkspacePendingSync,
  putCachedWorkspace,
  workspaceCacheSnapshot,
} from "@/features/write/offline-store";
import { checkGroveReachable } from "@/features/write/connectivity";

export type SyncResult =
  | { ok: true }
  | { ok: false; reason: "offline" | "lease" | "save" | "missing"; message?: string };

function pagesPayload(pages: StoryPage[]) {
  return pages.map((page, position) => ({
    id: page.id,
    parent_id: page.parentId,
    title: page.title || "Untitled",
    content: { html: page.content, unvisited: page.unvisited },
    page_type: page.pageType,
    fields: page.fields,
    position,
  }));
}

async function claimLease(
  supabase: SupabaseClient,
  workspaceId: string,
  leaseToken: string,
) {
  const { data, error } = await supabase.rpc("claim_workspace_edit_lease", {
    p_workspace_id: workspaceId,
    p_lease_token: leaseToken,
  });
  if (error) return { acquired: false as const, leaseToken };
  const result = data as {
    acquired?: boolean;
    leaseToken?: string;
  } | null;
  return {
    acquired: Boolean(result?.acquired),
    leaseToken: result?.leaseToken ?? leaseToken,
  };
}

export async function syncCachedWorkspacePages(options: {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
  workspaceName: string;
  pages: StoryPage[];
  leaseToken?: string;
}): Promise<SyncResult> {
  if (!(await checkGroveReachable())) {
    await putCachedWorkspace(
      workspaceCacheSnapshot({
        id: options.workspaceId,
        name: options.workspaceName,
        userId: options.userId,
        pages: options.pages,
        pendingSync: true,
      }),
    );
    return { ok: false, reason: "offline" };
  }

  const leaseToken = options.leaseToken ?? crypto.randomUUID();
  const lease = await claimLease(
    options.supabase,
    options.workspaceId,
    leaseToken,
  );
  if (!lease.acquired) {
    await markWorkspacePendingSync(options.workspaceId, true);
    return {
      ok: false,
      reason: "lease",
      message: "Another Grove window is editing this story.",
    };
  }

  const { error } = await options.supabase.rpc("save_workspace_pages", {
    p_workspace_id: options.workspaceId,
    p_lease_token: lease.leaseToken,
    p_pages: pagesPayload(options.pages),
  });

  await options.supabase.rpc("release_workspace_edit_lease", {
    p_workspace_id: options.workspaceId,
    p_lease_token: lease.leaseToken,
  });

  if (error) {
    await markWorkspacePendingSync(options.workspaceId, true);
    return { ok: false, reason: "save", message: error.message };
  }

  await putCachedWorkspace(
    workspaceCacheSnapshot({
      id: options.workspaceId,
      name: options.workspaceName,
      userId: options.userId,
      pages: options.pages,
      pendingSync: false,
    }),
  );
  return { ok: true };
}

export async function syncPendingCachedWorkspaces(options: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { listCachedWorkspaces } = await import("@/features/write/offline-store");
  const cached = await listCachedWorkspaces(options.userId);
  const results: { workspaceId: string; result: SyncResult }[] = [];
  for (const workspace of cached.filter((item) => item.pendingSync)) {
    const result = await syncCachedWorkspacePages({
      supabase: options.supabase,
      workspaceId: workspace.id,
      userId: workspace.userId,
      workspaceName: workspace.name,
      pages: workspace.pages,
    });
    results.push({ workspaceId: workspace.id, result });
  }
  return results;
}

export async function refreshWorkspaceCacheFromCloud(options: {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
}) {
  const { data: workspace } = await options.supabase
    .from("workspaces")
    .select("id,name")
    .eq("id", options.workspaceId)
    .maybeSingle();
  if (!workspace) return null;

  const { data: rows } = await options.supabase
    .from("pages")
    .select("id,parent_id,title,content,updated_at,page_type,fields")
    .eq("workspace_id", options.workspaceId)
    .is("deleted_at", null)
    .order("position");

  const { normalizePageFields, normalizePageType } = await import(
    "@/features/workspace/page-types"
  );

  const pages: StoryPage[] = (rows ?? []).map((page) => {
    const content = page.content as
      | { html?: string; unvisited?: boolean }
      | string
      | null;
    return {
      id: page.id,
      parentId: page.parent_id,
      title: page.title,
      content:
        typeof content === "string"
          ? content
          : content?.html || "<p>Begin writing your story…</p>",
      unvisited: typeof content === "object" && content?.unvisited === true,
      pageType: normalizePageType(page.page_type),
      fields: normalizePageFields(page.fields),
      updatedAt: new Date(page.updated_at).getTime(),
    };
  });

  const existing = await getCachedWorkspace(options.workspaceId);
  const snapshot = workspaceCacheSnapshot({
    id: workspace.id,
    name: workspace.name,
    userId: options.userId,
    pages,
    pendingSync: existing?.pendingSync ?? false,
  });
  await putCachedWorkspace(snapshot);
  return snapshot;
}
