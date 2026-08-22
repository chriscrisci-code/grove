import type { SupabaseClient } from "@supabase/supabase-js";

export type WriteSession = {
  userId: string;
  email: string | null;
};

export type WriteSessionResult =
  | { status: "ok"; session: WriteSession }
  | { status: "needs-sign-in" }
  | { status: "offline-no-session" };

const STORAGE_KEY = "grove-write-session";
export const LAST_WRITE_WORKSPACE_KEY = "grove-write-last-workspace";

type StoredWriteSession = WriteSession;

export function persistWriteSession(session: WriteSession) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function readStoredWriteSession(): WriteSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWriteSession;
    if (!parsed?.userId) return null;
    return {
      userId: parsed.userId,
      email: parsed.email ?? null,
    };
  } catch {
    return null;
  }
}

export function persistLastWriteWorkspace(workspaceId: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_WRITE_WORKSPACE_KEY, workspaceId);
}

export function readLastWriteWorkspace() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_WRITE_WORKSPACE_KEY);
}

export function isOfflineEnvironment() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export async function resolveWriteSession(
  supabase: SupabaseClient,
): Promise<WriteSessionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user;
  if (sessionUser) {
    const writeSession = {
      userId: sessionUser.id,
      email: sessionUser.email ?? null,
    };
    persistWriteSession(writeSession);
    return { status: "ok", session: writeSession };
  }

  const stored = readStoredWriteSession();
  if (stored) {
    return { status: "ok", session: stored };
  }

  if (isOfflineEnvironment()) {
    return { status: "offline-no-session" };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    const writeSession = {
      userId: userData.user.id,
      email: userData.user.email ?? null,
    };
    persistWriteSession(writeSession);
    return { status: "ok", session: writeSession };
  }

  return { status: "needs-sign-in" };
}
