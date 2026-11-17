import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacHex, randomToken } from "./crypto";
import type { RoleKey, SessionKind } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "c35_session";

const TTL_MS: Record<SessionKind, number> = {
  ADMIN_WEB: 8 * 3600_000,
  SMART_ID_WEB: 10 * 3600_000,
  KIOSK: 8 * 3600_000,
};

const hashToken = (t: string) => hmacHex(t, env.sessionPepper);

export async function createSession(opts: {
  institutionId: string;
  userId: string;
  kind: SessionKind;
  role: RoleKey;
  credentialId?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TTL_MS[opts.kind]);
  await prisma.authSession.create({
    data: { ...opts, tokenHash: hashToken(token), expiresAt, userAgent: opts.userAgent?.slice(0, 255) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { expiresAt };
}

export interface CurrentSession {
  sessionId: string;
  userId: string;
  institutionId: string;
  role: RoleKey;
  kind: SessionKind;
  user: { id: string; fullName: string; email: string | null; photoKey: string | null };
}

/** Resolve the session from the cookie, re-checking credential + account state on every request. */
export async function getSession(): Promise<CurrentSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, fullName: true, email: true, photoKey: true, status: true, archivedAt: true } },
      credential: { select: { status: true } },
    },
  });
  if (!s || s.revokedAt || s.expiresAt <= new Date()) return null;
  if (s.user.status !== "ACTIVE" || s.user.archivedAt) return null;
  if (s.credential && s.credential.status !== "ACTIVE") return null;
  if (Date.now() - s.lastSeenAt.getTime() > 60_000) {
    await prisma.authSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => null);
  }
  const { id, fullName, email, photoKey } = s.user;
  return {
    sessionId: s.id,
    userId: s.userId,
    institutionId: s.institutionId,
    role: s.role,
    kind: s.kind,
    user: { id, fullName, email, photoKey },
  };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
    });
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeUserSessions(userId: string, reason: string) {
  return prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}
