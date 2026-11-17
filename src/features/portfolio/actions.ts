"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { action, UserError } from "../shared";
import { notify } from "../notify";
import { studentOf, teacherOf } from "../assignments/context";

const PATHS = ["/student/portfolio", "/teacher/portfolio"];
const MANUAL = ["ACHIEVEMENT", "PROJECT", "CERTIFICATE", "SKILL", "MILESTONE"] as const;

export async function updateHeadline(headline: string) {
  return action("portfolio.view.own", async (s) => {
    const { studentId } = await studentOf(s);
    const h = headline.trim().slice(0, 255);
    await prisma.studentPortfolio.upsert({ where: { studentId }, create: { studentId, headline: h || null }, update: { headline: h || null } });
  }, PATHS);
}

const Add = z.object({
  type: z.enum(MANUAL),
  title: z.string().trim().min(1, "Add a title").max(255),
  summary: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  occurredAt: z.string().min(1, "Pick a date"),
});

export async function addPortfolioEntry(input: z.input<typeof Add>) {
  return action("portfolio.view.own", async (s) => {
    const d = Add.parse(input);
    const { studentId } = await studentOf(s);
    const when = new Date(d.occurredAt);
    if (Number.isNaN(when.getTime()) || when > new Date(Date.now() + 86_400_000)) throw new UserError("Choose a date that is not in the future.");
    const p = await prisma.studentPortfolio.upsert({ where: { studentId }, create: { studentId }, update: {} });
    await prisma.portfolioEntry.create({ data: { portfolioId: p.id, type: d.type, title: d.title, summary: d.summary, sourceType: "Manual", sourceId: randomBytes(10).toString("hex"), verified: false, occurredAt: when } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "portfolio.add", entityType: "StudentPortfolio", entityId: p.id });
  }, PATHS);
}

export async function deletePortfolioEntry(id: string) {
  return action("portfolio.view.own", async (s) => {
    const { studentId } = await studentOf(s);
    const e = await prisma.portfolioEntry.findFirst({ where: { id, sourceType: "Manual", portfolio: { studentId } } });
    if (!e) throw new UserError("Only entries you added yourself can be removed.");
    await prisma.portfolioEntry.delete({ where: { id } });
  }, PATHS);
}

/** A teacher who teaches the student's class can verify a self-reported entry. */
export async function verifyPortfolioEntry(id: string, verified: boolean) {
  return action("portfolio.view.any", async (s) => {
    const teacherId = await teacherOf(s);
    const e = await prisma.portfolioEntry.findFirst({ where: { id, portfolio: { student: { institutionId: s.institutionId } } }, include: { portfolio: { select: { studentId: true, student: { select: { userId: true } } } } } });
    if (!e) throw new UserError("Entry not found.");
    const teaches = await prisma.enrollment.count({ where: { studentId: e.portfolio.studentId, status: "ACTIVE", division: { teacherAssignments: { some: { teacherId } } } } });
    if (!teaches) throw new UserError("You can only verify entries for students you teach.");
    await prisma.portfolioEntry.update({ where: { id }, data: { verified } });
    if (verified) await notify(s.institutionId, [e.portfolio.student.userId], { type: "portfolio.verified", title: `Verified: ${e.title}`, link: "/student/portfolio" });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: verified ? "portfolio.verify" : "portfolio.unverify", entityType: "PortfolioEntry", entityId: id });
  }, PATHS);
}
