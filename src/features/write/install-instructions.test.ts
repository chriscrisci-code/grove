import { describe, expect, it } from "vitest";
import {
  detectInstallEnvironment,
  installGuideFor,
} from "./install-instructions";

describe("install instructions", () => {
  it("detects Windows Chrome", () => {
    expect(
      detectInstallEnvironment(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toEqual({ platform: "windows", browser: "chrome" });
  });

  it("gives Windows Chrome install steps", () => {
    const guide = installGuideFor({ platform: "windows", browser: "chrome" });
    expect(guide.title).toContain("Windows");
    expect(guide.title).toContain("Chrome");
    expect(guide.steps.join(" ")).toContain("Install page as app");
  });

  it("detects iPhone Safari", () => {
    expect(
      detectInstallEnvironment(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ platform: "ios", browser: "safari" });
  });
});
