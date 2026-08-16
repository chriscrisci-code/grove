export const MAX_COVER_BYTES = 5 * 1024 * 1024;

type CoverValidation =
  | {
      ok: true;
      extension: "jpg" | "png" | "webp";
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    }
  | { ok: false; error: string };

export function validateCoverBytes(
  bytes: Uint8Array,
  _declaredType: string,
  size: number,
): CoverValidation {
  if (size > MAX_COVER_BYTES) {
    return { ok: false, error: "Cover images must be 5 MB or smaller." };
  }
  const jpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

  if (jpeg) {
    return { ok: true, extension: "jpg", mimeType: "image/jpeg" };
  }
  if (png) {
    return { ok: true, extension: "png", mimeType: "image/png" };
  }
  if (webp) {
    return { ok: true, extension: "webp", mimeType: "image/webp" };
  }
  return {
    ok: false,
    error: "Cover images must be valid JPEG, PNG, or WebP files.",
  };
}
