import { describe, expect, it } from "vitest";
import { workspaceCacheSnapshot } from "./offline-store";

describe("workspaceCacheSnapshot", () => {
  it("marks pending sync when requested", () => {
    const snapshot = workspaceCacheSnapshot({
      id: "story-1",
      name: "North Ridge",
      userId: "user-1",
      pages: [],
      pendingSync: true,
    });
    expect(snapshot.pendingSync).toBe(true);
    expect(snapshot.name).toBe("North Ridge");
    expect(snapshot.cachedAt).toBeGreaterThan(0);
  });
});
