import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Chat content is encrypted at rest with AES-256-GCM. Each user gets their own key, derived with HKDF from the
 * server secret CHAT_ENCRYPTION_KEY and the user id, so a database dump (or an administrator browsing tables)
 * sees only ciphertext, and one user's key cannot open another user's chats. The user id is also bound in as
 * authenticated data, so a row copied to a different user fails to decrypt.
 */
const PREFIX = "v1:";

function masterKey(): Buffer {
  const k = process.env.CHAT_ENCRYPTION_KEY;
  if (!k || k.length < 32) throw new Error("CHAT_ENCRYPTION_KEY is missing or too short (use at least 32 random characters).");
  return Buffer.from(k, "utf8");
}

const userKey = (userId: string) => Buffer.from(hkdfSync("sha256", masterKey(), Buffer.from("campus2035-chat"), Buffer.from(userId), 32));

export const chatCryptoConfigured = () => (process.env.CHAT_ENCRYPTION_KEY?.length ?? 0) >= 32;

export function encryptChat(userId: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", userKey(userId), iv);
  c.setAAD(Buffer.from(userId));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

/** Returns plaintext. Rows written before encryption was enabled (no prefix) are returned as they are. */
export function decryptChat(userId: string, stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
    const d = createDecipheriv("aes-256-gcm", userKey(userId), raw.subarray(0, 12));
    d.setAAD(Buffer.from(userId));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return "[This message could not be decrypted.]";
  }
}
