import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { logAuth } from "./log";
import { rateLimit } from "./rate-limit";
import { createSession } from "./session";

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, ARGON);

export type AdminLoginResult = { ok: true } | { ok: false; status: number; error: string };

const GENERIC: AdminLoginResult = { ok: false, status: 401, error: "Invalid email, username or password" };

export async function adminLogin(input: {
  identifier: string;
  password: string;
  ip: string;
  userAgent: string | null;
}): Promise<AdminLoginResult> {
  const ident = input.identifier.trim().toLowerCase();
  if (!(await rateLimit(`admin:ip:${input.ip}`, 10, 60_000)) || !(await rateLimit(`admin:id:${ident}`, 10, 300_000))) {
    await logAuth({ method: "ADMIN_PASSWORD", result: "RATE_LIMITED", portal: "admin", ip: input.ip, userAgent: input.userAgent });
    return { ok: false, status: 429, error: "Too many attempts. Try again later." };
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: ident }, { username: ident }], status: "ACTIVE", archivedAt: null, passwordHash: { not: null }, roles: { some: { role: { key: { in: ["SUPER_ADMIN", "ADMIN"] } } } } },
    include: { roles: { include: { role: true } } },
  });
  if (!user?.passwordHash) {
    await logAuth({ method: "ADMIN_PASSWORD", result: "INVALID_CREDENTIAL", portal: "admin", ip: input.ip, userAgent: input.userAgent });
    return GENERIC;
  }
  const base = { institutionId: user.institutionId, userId: user.id, method: "ADMIN_PASSWORD" as const, portal: "admin", ip: input.ip, userAgent: input.userAgent };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAuth({ ...base, result: "LOCKED" });
    return { ok: false, status: 423, error: "Account temporarily locked. Try again later." };
  }

  const good = await verify(user.passwordHash, input.password).catch(() => false);
  if (!good) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null },
    });
    await logAuth({ ...base, result: "INVALID_CREDENTIAL" });
    return GENERIC;
  }

  const role = user.roles.some((r) => r.role.key === "SUPER_ADMIN") ? "SUPER_ADMIN" : "ADMIN";
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession({ institutionId: user.institutionId, userId: user.id, kind: "ADMIN_WEB", role, ip: input.ip, userAgent: input.userAgent ?? undefined });
  await logAuth({ ...base, result: "SUCCESS" });
  return { ok: true };
}
