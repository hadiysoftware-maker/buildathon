import "server-only";
import { createPublicKey, verify } from "node:crypto";
import { prisma } from "@/lib/db";
import { hmacHex, randomToken } from "./crypto";
import { env } from "@/lib/env";

const CHALLENGE_TTL_MS = 2 * 60_000;

export async function issueChallenge(deviceId: string): Promise<string | null> {
  const d = await prisma.registeredDevice.findUnique({ where: { id: deviceId }, select: { status: true } });
  if (!d || d.status !== "ACTIVE") return null;
  const nonce = randomToken(24);
  await prisma.deviceChallenge.create({
    data: { deviceId, nonce, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return nonce;
}

/**
 * Verify an ECDSA P-256 signature (IEEE-P1363, as produced by WebCrypto) over the nonce
 * with the device's enrolled public key. Consumes the challenge (single use).
 */
export async function verifyDeviceProof(deviceId: string, nonce: string, signatureB64: string) {
  const device = await prisma.registeredDevice.findUnique({ where: { id: deviceId } });
  if (!device || device.status !== "ACTIVE" || !device.publicKeyJwk) return null;
  const ch = await prisma.deviceChallenge.findUnique({ where: { nonce } });
  if (!ch || ch.deviceId !== deviceId || ch.usedAt || ch.expiresAt <= new Date()) return null;
  const consumed = await prisma.deviceChallenge.updateMany({
    where: { id: ch.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return null;
  try {
    const key = createPublicKey({ key: device.publicKeyJwk as import("node:crypto").JsonWebKey, format: "jwk" });
    const ok = verify(
      "sha256",
      Buffer.from(nonce),
      { key, dsaEncoding: "ieee-p1363" },
      Buffer.from(signatureB64, "base64"),
    );
    if (!ok) return null;
  } catch {
    return null;
  }
  await prisma.registeredDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return device;
}

export function newEnrollmentCode() {
  const code = randomToken(9);
  return { code, hash: hmacHex(code, env.sessionPepper) };
}
export const hashEnrollmentCode = (code: string) => hmacHex(code, env.sessionPepper);
