import type { StoryPage } from "@/features/workspace/workspace";

export type CachedWorkspace = {
  id: string;
  name: string;
  userId: string;
  pages: StoryPage[];
  cachedAt: number;
  pendingSync: boolean;
};

const DB_NAME = "grove-write";
const DB_VERSION = 1;
const STORE = "workspaces";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = run(store);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB failed"));
        request.onsuccess = () => resolve(request.result as T);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB transaction failed"));
        };
      }),
  );
}

export async function putCachedWorkspace(workspace: CachedWorkspace) {
  await runTransaction("readwrite", (store) => store.put(workspace));
}

export async function getCachedWorkspace(
  workspaceId: string,
): Promise<CachedWorkspace | null> {
  return runTransaction("readonly", (store) => store.get(workspaceId));
}

export async function listCachedWorkspaces(
  userId: string,
): Promise<CachedWorkspace[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = store.index("userId");
    const request = index.getAll(userId);
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("IndexedDB failed"));
    };
    request.onsuccess = () => {
      const rows = (request.result as CachedWorkspace[] | undefined) ?? [];
      db.close();
      resolve(
        rows.sort(
          (left, right) =>
            (right.cachedAt ?? 0) - (left.cachedAt ?? 0) ||
            left.name.localeCompare(right.name),
        ),
      );
    };
  });
}

export async function markWorkspacePendingSync(
  workspaceId: string,
  pendingSync: boolean,
) {
  const existing = await getCachedWorkspace(workspaceId);
  if (!existing) return;
  await putCachedWorkspace({ ...existing, pendingSync });
}

export function workspaceCacheSnapshot(options: {
  id: string;
  name: string;
  userId: string;
  pages: StoryPage[];
  pendingSync?: boolean;
}): CachedWorkspace {
  return {
    id: options.id,
    name: options.name,
    userId: options.userId,
    pages: options.pages,
    cachedAt: Date.now(),
    pendingSync: options.pendingSync ?? false,
  };
}
