import "server-only";
import { prisma } from "@/lib/db";
import { logAuth } from "./log";
import { rateLimit } from "./rate-limit";
import { verifyCredential } from "./smart-id";
import { verifyDeviceProof } from "./device";
import { createSession } from "./session";
import type { AuthResult, RoleKey } from "@/generated/prisma/enums";

export type Portal = "kiosk" | "teacher";

export type SmartIdLoginResult =
  | { ok: true; redirect: string; role: RoleKey }
  | { ok: false; code: AuthResult; status: number };

const PORTAL_ROLE: Record<Portal, RoleKey> = { kiosk: "STUDENT", teacher: "TEACHER" };
const HOME: Record<RoleKey, string> = {
  STUDENT: "/student",
  TEACHER: "/teacher",
  ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
  GUARDIAN: "/student",
};

const STATUS: Partial<Record<AuthResult, number>> = {
  INVALID_CREDENTIAL: 401,
  REVOKED: 403,
  SUSPENDED: 403,
  REPLACED: 403,
  ACCOUNT_INACTIVE: 403,
  DEVICE_UNAUTHORIZED: 403,
  WRONG_PORTAL: 403,
  RATE_LIMITED: 429,
};

export async function requireDevicePolicy(institutionId: string): Promise<boolean> {
  const s = await prisma.institutionSetting.findUnique({
    where: { institutionId_key: { institutionId, key: "requireEnrolledDevice" } },
  });
  return s?.value === true;
}

export async function smartIdLogin(input: {
  payload: string;
  portal: Portal;
  ip: string;
  userAgent: string | null;
  device?: { id: string; nonce: string; signature: string };
}): Promise<SmartIdLoginResult> {
  const fail = async (
    code: AuthResult,
    extra: { institutionId?: string; userId?: string; credentialId?: string; deviceId?: string } = {},
  ): Promise<SmartIdLoginResult> => {
    await logAuth({ ...extra, method: "SMART_ID", result: code, portal: input.portal, ip: input.ip, userAgent: input.userAgent });
    return { ok: false, code, status: STATUS[code] ?? 400 };
  };

  // Brute-force protection: per-IP window.
  if (!(await rateLimit(`smartid:ip:${input.ip}`, 30, 60_000))) return fail("RATE_LIMITED");

  const v = await verifyCredential(input.payload);
  if (!v.ok) {
    if (v.reason === "INVALID_CREDENTIAL") return fail("INVALID_CREDENTIAL");
    return fail(v.reason, { userId: v.userId, credentialId: v.credentialId });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: v.userId },
    include: { roles: { include: { role: true } }, student: true, teacher: true },
  });
  const wanted = PORTAL_ROLE[input.portal];
  const role = user.roles.map((r) => r.role.key).find((k) => k === wanted);
  const base = { institutionId: user.institutionId, userId: user.id, credentialId: v.credentialId };
  if (!role) return fail("WRONG_PORTAL", base);

  // Device policy (students on the kiosk): enrolled device with a valid proof-of-possession.
  let deviceId: string | undefined;
  if (input.portal === "kiosk" && (await requireDevicePolicy(user.institutionId))) {
    if (!input.device) return fail("DEVICE_UNAUTHORIZED", base);
    const device = await verifyDeviceProof(input.device.id, input.device.nonce, input.device.signature);
    if (!device || device.institutionId !== user.institutionId || device.assignedStudentId !== user.student?.id) {
      return fail("DEVICE_UNAUTHORIZED", { ...base, deviceId: input.device.id });
    }
    deviceId = device.id;
  }

  await createSession({
    institutionId: user.institutionId,
    userId: user.id,
    kind: input.portal === "kiosk" ? "KIOSK" : "SMART_ID_WEB",
    role,
    credentialId: v.credentialId,
    deviceId,
    ip: input.ip,
    userAgent: input.userAgent ?? undefined,
  });
  await prisma.smartIdCredential.update({ where: { id: v.credentialId }, data: { lastUsedAt: new Date() } });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAuth({ ...base, deviceId, method: "SMART_ID", result: "SUCCESS", portal: input.portal, ip: input.ip, userAgent: input.userAgent });
  return { ok: true, redirect: HOME[role], role };
}

export { HOME as ROLE_HOME };
