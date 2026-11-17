import "server-only";
import { verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { logAuth } from "./log";
import { rateLimit } from "./rate-limit";
import { createSession } from "./session";
import { ROLE_HOME, type Portal } from "./login";
import type { RoleKey } from "@/generated/prisma/enums";

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
const PORTAL_ROLE: Record<Portal, RoleKey> = { kiosk: "STUDENT", teacher: "TEACHER" };

export type PasswordLoginResult = { ok: true; redirect: string } | { ok: false; status: number; error: string };
const GENERIC: PasswordLoginResult = { ok: false, status: 401, error: "Invalid username or password" };

/** Secondary sign-in for students and teachers (Smart ID card stays the primary method). */
export async function passwordLogin(input: { username: string; password: string; portal: Portal; ip: string; userAgent: string | null }): Promise<PasswordLoginResult> {
  const username = input.username.trim().toLowerCase();
  const wanted = PORTAL_ROLE[input.portal];
  if (!(await rateLimit(`upw:ip:${input.ip}`, 15, 60_000)) || !(await rateLimit(`upw:u:${username}`, 10, 300_000))) {
    await logAuth({ method: "USER_PASSWORD", result: "RATE_LIMITED", portal: input.portal, ip: input.ip, userAgent: input.userAgent });
    return { ok: false, status: 429, error: "Too many attempts. Try again later." };
  }

  const user = await prisma.user.findFirst({
    where: { username, archivedAt: null, passwordHash: { not: null } },
    include: { roles: { include: { role: true } } },
  });
  if (!user?.passwordHash) {
    await logAuth({ method: "USER_PASSWORD", result: "INVALID_CREDENTIAL", portal: input.portal, ip: input.ip, userAgent: input.userAgent });
    return GENERIC;
  }
  const base = { institutionId: user.institutionId, userId: user.id, method: "USER_PASSWORD" as const, portal: input.portal, ip: input.ip, userAgent: input.userAgent };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAuth({ ...base, result: "LOCKED" });
    return { ok: false, status: 423, error: "Account temporarily locked. Try again later." };
  }
  const good = await verify(user.passwordHash, input.password).catch(() => false);
  if (!good) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null } });
    await logAuth({ ...base, result: "INVALID_CREDENTIAL" });
    return GENERIC;
  }
  if (user.status !== "ACTIVE") {
    await logAuth({ ...base, result: "ACCOUNT_INACTIVE" });
    return { ok: false, status: 403, error: "This account is not active." };
  }
  if (!user.roles.some((r) => r.role.key === wanted)) {
    await logAuth({ ...base, result: "WRONG_PORTAL" });
    return { ok: false, status: 403, error: "This account cannot sign in here." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession({
    institutionId: user.institutionId, userId: user.id, kind: input.portal === "kiosk" ? "KIOSK" : "SMART_ID_WEB",
    role: wanted, ip: input.ip, userAgent: input.userAgent ?? undefined,
  });
  await logAuth({ ...base, result: "SUCCESS" });
  return { ok: true, redirect: ROLE_HOME[wanted] };
}
