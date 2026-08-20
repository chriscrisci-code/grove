import { describe, expect, it } from "vitest";
import {
  RESEARCH_IMAGE_URL,
  attachSignedImageUrls,
  collectImageFiles,
  isResearchImage,
  researchImageTitle,
  type ResearchItem,
} from "./research-images";

function item(overrides: Partial<ResearchItem> = {}): ResearchItem {
  return {
    id: "1",
    kind: "link",
    url: "https://example.com",
    title: "Example",
    description: null,
    imageUrl: null,
    faviconUrl: null,
    storagePath: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("research images", () => {
  it("treats grove image records as images", () => {
    expect(isResearchImage(item({ kind: "image", url: RESEARCH_IMAGE_URL }))).toBe(
      true,
    );
    expect(isResearchImage(item())).toBe(false);
  });

  it("uses the file name without a path", () => {
    expect(researchImageTitle("folder/castle.png")).toBe("castle.png");
    expect(researchImageTitle("")).toBe("Research image");
  });

  it("keeps jpeg, png, and webp files", () => {
    const files = collectImageFiles([
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.gif", { type: "image/gif" }),
      new File(["c"], "c.webp", { type: "image/webp" }),
      new File(["d"], "d.png", { type: "" }),
    ]);
    expect(files.map((file) => file.name)).toEqual(["a.jpg", "c.webp", "d.png"]);
  });

  it("attaches signed urls by storage path", () => {
    const withPath = item({
      id: "2",
      kind: "image",
      url: RESEARCH_IMAGE_URL,
      storagePath: "ws/page/one.png",
    });
    const [signed] = attachSignedImageUrls(
      [withPath, item()],
      [{ path: "ws/page/one.png", signedUrl: "https://signed.example/one.png" }],
    );
    expect(signed.imageUrl).toBe("https://signed.example/one.png");
  });
});
