import { describe, expect, it } from "vitest";
import {
  canCreatePage,
  canCreateProject,
  canUseFeature,
  getPlanAccess,
  planAccessFromBilling,
  planLimitMessage,
} from "./plan";

describe("plan access", () => {
  it("unlocks paid features while testing", () => {
    const access = getPlanAccess({ unlockPaid: true, subscribed: false });
    expect(access.isPaid).toBe(true);
    expect(canCreateProject(8, access)).toBe(true);
    expect(canCreatePage(80, access)).toBe(true);
    expect(canUseFeature("aiAsk", access)).toBe(true);
    expect(canUseFeature("research", access)).toBe(true);
    expect(canUseFeature("chapterPdf", access)).toBe(true);
  });

  it("keeps free writing tools on a free plan", () => {
    const access = getPlanAccess({ unlockPaid: false, subscribed: false });
    expect(access.limits).toEqual({ projects: 1, pagesPerProject: 50 });
    expect(canCreateProject(0, access)).toBe(true);
    expect(canCreateProject(1, access)).toBe(false);
    expect(canCreatePage(49, access)).toBe(true);
    expect(canCreatePage(50, access)).toBe(false);
    expect(canUseFeature("aiAsk", access)).toBe(false);
    expect(canUseFeature("research", access)).toBe(false);
    expect(canUseFeature("chapterPdf", access)).toBe(false);
    expect(canUseFeature("collaboration", access)).toBe(false);
    expect(canUseFeature("relationships", access)).toBe(true);
    expect(canUseFeature("nightColors", access)).toBe(true);
    expect(canUseFeature("covers", access)).toBe(true);
    expect(canUseFeature("tags", access)).toBe(true);
    expect(canUseFeature("findLinks", access)).toBe(true);
    expect(canUseFeature("spellingThesaurus", access)).toBe(true);
  });

  it("treats a subscriber as paid", () => {
    const access = getPlanAccess({ unlockPaid: false, subscribed: true });
    expect(canUseFeature("aiAsk", access)).toBe(true);
    expect(canCreatePage(200, access)).toBe(true);
  });

  it("keeps paid features locked unless the account is Plus", () => {
    expect(getPlanAccess().isPaid).toBe(false);
    expect(planAccessFromBilling("free").isPaid).toBe(false);
    expect(planAccessFromBilling("plus").isPaid).toBe(true);
  });

  it("explains the free story limit", () => {
    expect(planLimitMessage("extraProjects")).toContain("1 story");
    expect(planLimitMessage("extraPages")).toContain("50 pages");
  });
});
