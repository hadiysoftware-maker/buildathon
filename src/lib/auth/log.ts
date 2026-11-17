import "server-only";
import { prisma } from "@/lib/db";
import type { AuthMethod, AuthResult } from "@/generated/prisma/enums";

export async function logAuth(e: {
  institutionId?: string | null;
  userId?: string | null;
  credentialId?: string | null;
  deviceId?: string | null;
  method: AuthMethod;
  result: AuthResult;
  portal?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.authenticationLog
    .create({ data: { ...e, userAgent: e.userAgent?.slice(0, 255) } })
    .catch(() => null);
}

export async function audit(e: {
  institutionId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  await prisma.auditLog.create({ data: { ...e, metadata: e.metadata as object | undefined } });
}
