import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacHex, randomToken, safeEqualHex } from "./crypto";
import { encodeCredential, parseCredential } from "./smart-id-format";

/** Create a credential for a user. Returns the QR payload ONCE; only an HMAC is stored. */
export async function issueCredential(opts: {
  institutionId: string;
  userId: string;
  issuedById?: string;
  cardNumber?: number;
}) {
  const secret = randomToken(32);
  const row = await prisma.smartIdCredential.create({
    data: {
      institutionId: opts.institutionId,
      userId: opts.userId,
      issuedById: opts.issuedById,
      cardNumber: opts.cardNumber ?? 1,
      secretHash: hmacHex(secret, env.smartIdPepper),
    },
  });
  return { credentialId: row.id, payload: encodeCredential(row.id, secret) };
}

export type VerifyFailure = "INVALID_CREDENTIAL" | "REVOKED" | "SUSPENDED" | "REPLACED" | "ACCOUNT_INACTIVE";
export type VerifyOutcome =
  | { ok: true; credentialId: string; userId: string }
  | { ok: false; reason: VerifyFailure; credentialId?: string; userId?: string };

export async function verifyCredential(payload: string): Promise<VerifyOutcome> {
  const parsed = parseCredential(payload);
  if (!parsed) return { ok: false, reason: "INVALID_CREDENTIAL" };
  const cred = await prisma.smartIdCredential.findUnique({
    where: { id: parsed.id },
    include: { user: { select: { id: true, status: true, archivedAt: true } } },
  });
  // Always hash, even if not found, to keep timing uniform.
  const computed = hmacHex(parsed.secret, env.smartIdPepper);
  if (!cred || !safeEqualHex(computed, cred.secretHash)) return { ok: false, reason: "INVALID_CREDENTIAL" };
  const ids = { credentialId: cred.id, userId: cred.userId };
  if (cred.status === "REVOKED") return { ok: false, reason: "REVOKED", ...ids };
  if (cred.status === "SUSPENDED") return { ok: false, reason: "SUSPENDED", ...ids };
  if (cred.status === "REPLACED") return { ok: false, reason: "REPLACED", ...ids };
  if (cred.user.status !== "ACTIVE" || cred.user.archivedAt) return { ok: false, reason: "ACCOUNT_INACTIVE", ...ids };
  return { ok: true, ...ids };
}

/** Revoke/suspend/reactivate a credential; non-active states kill its sessions in the same transaction. */
export async function setCredentialStatus(opts: {
  credentialId: string;
  status: "REVOKED" | "SUSPENDED" | "ACTIVE";
  byId: string;
  reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.smartIdCredential.update({
      where: { id: opts.credentialId },
      data: {
        status: opts.status,
        statusChangedAt: new Date(),
        statusChangedById: opts.byId,
        statusReason: opts.reason,
      },
    });
    if (opts.status !== "ACTIVE") {
      await tx.authSession.updateMany({
        where: { credentialId: c.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: `CARD_${opts.status}` },
      });
    }
    return c;
  });
}

/** Replace a card: old credential becomes REPLACED (sessions revoked), a new one is issued. */
export async function replaceCredential(opts: { credentialId: string; byId: string; reason?: string }) {
  const old = await prisma.smartIdCredential.findUniqueOrThrow({ where: { id: opts.credentialId } });
  const secret = randomToken(32);
  const created = await prisma.$transaction(async (tx) => {
    const fresh = await tx.smartIdCredential.create({
      data: {
        institutionId: old.institutionId,
        userId: old.userId,
        issuedById: opts.byId,
        cardNumber: old.cardNumber + 1,
        secretHash: hmacHex(secret, env.smartIdPepper),
      },
    });
    await tx.smartIdCredential.update({
      where: { id: old.id },
      data: {
        status: "REPLACED",
        replacedById: fresh.id,
        statusChangedAt: new Date(),
        statusChangedById: opts.byId,
        statusReason: opts.reason ?? "Replaced",
      },
    });
    await tx.authSession.updateMany({
      where: { userId: old.userId, revokedAt: null, kind: { in: ["SMART_ID_WEB", "KIOSK"] } },
      data: { revokedAt: new Date(), revokeReason: "CARD_REPLACED" },
    });
    return fresh;
  });
  return { credentialId: created.id, payload: encodeCredential(created.id, secret) };
}
