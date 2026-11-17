"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { issueCredential, replaceCredential, setCredentialStatus } from "@/lib/auth/smart-id";
import { revokeUserSessions } from "@/lib/auth/session";
import { newEnrollmentCode } from "@/lib/auth/device";
import { action, UserError } from "../shared";
import { buildCardView, type CardView } from "./card";

const P = "smartid.manage" as const;
const PATHS = ["/admin/smart-id"];

async function ownedUser(institutionId: string, userId: string) {
  const u = await prisma.user.findFirst({ where: { id: userId, institutionId, OR: [{ student: { isNot: null } }, { teacher: { isNot: null } }] } });
  if (!u) throw new UserError("Person not found.");
  return u;
}
async function ownedCredential(institutionId: string, id: string) {
  const c = await prisma.smartIdCredential.findFirst({ where: { id, institutionId } });
  if (!c) throw new UserError("Card not found.");
  return c;
}

/** Issue a first card. Refuses if the person already has an active card (use Replace instead). */
export async function issueCard(userId: string) {
  return action<CardView>(P, async (s) => {
    await ownedUser(s.institutionId, userId);
    const active = await prisma.smartIdCredential.count({ where: { userId, status: { in: ["ACTIVE", "SUSPENDED"] } } });
    if (active > 0) throw new UserError("This person already has a card. Replace it to print a new one.");
    const prev = await prisma.smartIdCredential.count({ where: { userId } });
    const c = await issueCredential({ institutionId: s.institutionId, userId, issuedById: s.userId, cardNumber: prev + 1 });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "smartid.issue", entityType: "SmartIdCredential", entityId: c.credentialId });
    return buildCardView(userId, c.credentialId, c.payload);
  }, PATHS);
}

/** Issue cards for many people who have none. Capped so a single request stays bounded. */
export async function bulkIssueCards(userIds: string[]) {
  return action<{ cards: CardView[]; skipped: number }>(P, async (s) => {
    const ids = z.array(z.string().max(30)).min(1).max(100).parse(userIds);
    const cards: CardView[] = [];
    let skipped = 0;
    for (const id of ids) {
      const u = await prisma.user.findFirst({ where: { id, institutionId: s.institutionId, status: "ACTIVE", OR: [{ student: { isNot: null } }, { teacher: { isNot: null } }] } });
      const has = u ? await prisma.smartIdCredential.count({ where: { userId: id, status: { in: ["ACTIVE", "SUSPENDED"] } } }) : 1;
      if (!u || has > 0) { skipped++; continue; }
      const prev = await prisma.smartIdCredential.count({ where: { userId: id } });
      const c = await issueCredential({ institutionId: s.institutionId, userId: id, issuedById: s.userId, cardNumber: prev + 1 });
      cards.push(await buildCardView(id, c.credentialId, c.payload));
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "smartid.bulkIssue", entityType: "SmartIdCredential", metadata: { count: cards.length } });
    return { cards, skipped };
  }, PATHS);
}

/** Lost/damaged card: old credential → REPLACED (its sessions die), new credential issued. */
export async function replaceCard(credentialId: string, reason?: string) {
  return action<CardView>(P, async (s) => {
    const c = await ownedCredential(s.institutionId, credentialId);
    if (c.status === "REPLACED") throw new UserError("This card was already replaced.");
    const n = await replaceCredential({ credentialId, byId: s.userId, reason: reason?.slice(0, 255) });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "smartid.replace", entityType: "SmartIdCredential", entityId: credentialId });
    return buildCardView(c.userId, n.credentialId, n.payload);
  }, PATHS);
}

async function change(institutionId: string, actorId: string, credentialId: string, status: "REVOKED" | "SUSPENDED" | "ACTIVE", reason?: string) {
  const c = await ownedCredential(institutionId, credentialId);
  if (c.status === "REPLACED") throw new UserError("A replaced card cannot be changed.");
  if (c.status === "REVOKED" && status !== "REVOKED") throw new UserError("A revoked card cannot be reactivated. Replace it instead.");
  await setCredentialStatus({ credentialId, status, byId: actorId, reason: reason?.slice(0, 255) });
  await audit({ institutionId, actorId, action: `smartid.${status.toLowerCase()}`, entityType: "SmartIdCredential", entityId: credentialId });
}
export async function revokeCard(credentialId: string, reason?: string) {
  return action(P, (s) => change(s.institutionId, s.userId, credentialId, "REVOKED", reason), PATHS);
}
export async function suspendCard(credentialId: string, reason?: string) {
  return action(P, (s) => change(s.institutionId, s.userId, credentialId, "SUSPENDED", reason), PATHS);
}
export async function reactivateCard(credentialId: string) {
  return action(P, (s) => change(s.institutionId, s.userId, credentialId, "ACTIVE"), PATHS);
}

/** Force sign-out everywhere for a person (e.g. suspected misuse) without touching the card. */
export async function revokeSessionsFor(userId: string) {
  return action<number>(P, async (s) => {
    await ownedUser(s.institutionId, userId);
    const r = await revokeUserSessions(userId, "ADMIN_REVOKED");
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "session.revokeAll", entityType: "User", entityId: userId, metadata: { count: r.count } });
    return r.count;
  }, PATHS);
}

// ── Devices ─────────────────────────────────────────────────────
const D = "devices.manage" as const;
const DPATH = ["/admin/devices"];

const DeviceSchema = z.object({
  assetTag: z.string().trim().min(1, "Asset tag is required").max(60),
  label: z.string().trim().min(1, "Label is required").max(120),
  assignedStudentId: z.string().max(30).optional().transform((v) => v || undefined),
});

export async function createDevice(v: Record<string, string>) {
  return action(D, async (s) => {
    const d = DeviceSchema.parse(v);
    if (d.assignedStudentId) {
      const st = await prisma.studentProfile.findFirst({ where: { id: d.assignedStudentId, institutionId: s.institutionId } });
      if (!st) throw new UserError("Student not found.");
    }
    const row = await prisma.registeredDevice.create({ data: { ...d, institutionId: s.institutionId } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "device.create", entityType: "RegisteredDevice", entityId: row.id });
  }, DPATH);
}

/** Returns the one-time enrollment code. Only its hash is stored; it expires in 30 minutes. */
export async function issueEnrollmentCode(deviceId: string) {
  return action<{ code: string; expiresAt: string }>(D, async (s) => {
    const dev = await prisma.registeredDevice.findFirst({ where: { id: deviceId, institutionId: s.institutionId } });
    if (!dev) throw new UserError("Device not found.");
    if (dev.status === "RETIRED") throw new UserError("Retired devices cannot be enrolled.");
    const { code, hash } = newEnrollmentCode();
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    // Re-enrolling replaces any previous key: the device returns to PENDING until the kiosk completes enrollment.
    await prisma.registeredDevice.update({ where: { id: deviceId }, data: { status: "PENDING", publicKeyJwk: undefined, enrollmentCodeHash: hash, enrollmentExpiresAt: expiresAt } });
    await prisma.authSession.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "DEVICE_REENROLL" } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "device.enrollmentCode", entityType: "RegisteredDevice", entityId: deviceId });
    return { code, expiresAt: expiresAt.toISOString() };
  }, DPATH);
}

export async function setDeviceStatus(deviceId: string, status: "ACTIVE" | "SUSPENDED" | "RETIRED") {
  return action(D, async (s) => {
    const dev = await prisma.registeredDevice.findFirst({ where: { id: deviceId, institutionId: s.institutionId } });
    if (!dev) throw new UserError("Device not found.");
    if (status === "ACTIVE" && !dev.publicKeyJwk) throw new UserError("Enroll the device before activating it.");
    await prisma.registeredDevice.update({ where: { id: deviceId }, data: { status } });
    if (status !== "ACTIVE") await prisma.authSession.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: `DEVICE_${status}` } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: `device.${status.toLowerCase()}`, entityType: "RegisteredDevice", entityId: deviceId });
  }, DPATH);
}

export async function setRequireEnrolledDevice(required: boolean) {
  return action("institution.manage", async (s) => {
    await prisma.institutionSetting.upsert({
      where: { institutionId_key: { institutionId: s.institutionId, key: "requireEnrolledDevice" } },
      create: { institutionId: s.institutionId, key: "requireEnrolledDevice", value: required },
      update: { value: required },
    });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "policy.requireEnrolledDevice", entityType: "InstitutionSetting", metadata: { required } });
  }, DPATH);
}
