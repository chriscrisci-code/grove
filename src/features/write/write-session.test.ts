import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  persistWriteSession,
  readStoredWriteSession,
  resolveWriteSession,
} from "./write-session";

describe("write session", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a stored session", () => {
    persistWriteSession({ userId: "user-1", email: "a@example.com" });
    expect(readStoredWriteSession()).toEqual({
      userId: "user-1",
      email: "a@example.com",
    });
  });

  it("uses getSession when available", async () => {
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: "live-user", email: "live@example.com" } },
          },
        }),
        getUser: vi.fn(),
      },
    };
    const result = await resolveWriteSession(supabase as never);
    expect(result).toEqual({
      status: "ok",
      session: { userId: "live-user", email: "live@example.com" },
    });
  });

  it("falls back to stored session offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    persistWriteSession({ userId: "stored-user", email: "stored@example.com" });
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn(),
      },
    };
    const result = await resolveWriteSession(supabase as never);
    expect(result).toEqual({
      status: "ok",
      session: { userId: "stored-user", email: "stored@example.com" },
    });
  });

  it("reports offline without a stored session", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn(),
      },
    };
    expect(await resolveWriteSession(supabase as never)).toEqual({
      status: "offline-no-session",
    });
  });
});
