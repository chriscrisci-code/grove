import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function encryptionKey() {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("AI key encryption is not configured.");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error("AI_KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptSecret(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(value: EncryptedValue) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
