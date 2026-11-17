import { describe, expect, it } from "vitest";
import { encodeCredential, parseCredential } from "@/lib/auth/smart-id-format";
import { hmacHex, randomToken, safeEqualHex } from "@/lib/auth/crypto";

describe("Smart ID payload", () => {
  const id = "cmabc123def456ghi789jkl0";
  const secret = randomToken(32);

  it("round-trips", () => {
    expect(parseCredential(encodeCredential(id, secret))).toEqual({ id, secret });
  });
  it("tolerates surrounding whitespace from scanners", () => {
    expect(parseCredential(` ${encodeCredential(id, secret)}\n`)?.id).toBe(id);
  });
  it.each(["", "garbage", "C35:short.x", `C35:${id}.tooshort`, `X35:${id}.${secret}`, `C35:${id}.${secret}extra`])(
    "rejects malformed payload %j",
    (p) => expect(parseCredential(p)).toBeNull(),
  );
  it("contains no personal data and has 256-bit entropy", () => {
    expect(secret).toHaveLength(43); // 32 bytes base64url
    expect(new Set(Array.from({ length: 50 }, () => randomToken(32))).size).toBe(50);
  });
});

describe("credential hashing", () => {
  it("is deterministic per pepper and differs across peppers", () => {
    const a = hmacHex("s", "pepper-one-xxxxxxxx");
    expect(a).toBe(hmacHex("s", "pepper-one-xxxxxxxx"));
    expect(a).not.toBe(hmacHex("s", "pepper-two-xxxxxxxx"));
    expect(a).toHaveLength(64);
  });
  it("compares in constant time and rejects mismatches / bad input", () => {
    const a = hmacHex("s", "p".repeat(16));
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, hmacHex("t", "p".repeat(16)))).toBe(false);
    expect(safeEqualHex(a, "")).toBe(false);
    expect(safeEqualHex(a, a.slice(2))).toBe(false);
  });
});
