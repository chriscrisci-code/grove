import { describe, expect, it } from "vitest";
import {
  MAX_COVER_BYTES,
  validateCoverBytes,
} from "./cover-validation";

describe("validateCoverBytes", () => {
  it("accepts genuine supported image signatures", () => {
    expect(
      validateCoverBytes(
        new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        "image/jpeg",
        100,
      ),
    ).toEqual({
      ok: true,
      extension: "jpg",
      mimeType: "image/jpeg",
    });
    expect(
      validateCoverBytes(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
        ]),
        "image/png",
        100,
      ),
    ).toEqual({
      ok: true,
      extension: "png",
      mimeType: "image/png",
    });
  });

  it("rejects a spoofed MIME type", () => {
    const result = validateCoverBytes(
      new TextEncoder().encode("not an image"),
      "image/png",
      12,
    );
    expect(result.ok).toBe(false);
  });

  it("uses the real image signature when a filename has the wrong extension", () => {
    expect(
      validateCoverBytes(
        new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        "image/png",
        100,
      ),
    ).toEqual({
      ok: true,
      extension: "jpg",
      mimeType: "image/jpeg",
    });
  });

  it("rejects oversized files", () => {
    const result = validateCoverBytes(
      new Uint8Array([0xff, 0xd8, 0xff]),
      "image/jpeg",
      MAX_COVER_BYTES + 1,
    );
    expect(result).toEqual({
      ok: false,
      error: "Cover images must be 5 MB or smaller.",
    });
  });
});
