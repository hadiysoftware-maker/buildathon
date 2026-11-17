import "server-only";
import { prisma } from "@/lib/db";

/** Idempotent portfolio evidence, keyed by the record it came from. */
export async function addPortfolio(studentId: string, e: { type: "ASSIGNMENT" | "QUIZ"; title: string; summary: string; sourceType: string; sourceId: string }) {
  try {
    const p = await prisma.studentPortfolio.upsert({ where: { studentId }, create: { studentId }, update: {} });
    await prisma.portfolioEntry.upsert({
      where: { portfolioId_sourceType_sourceId: { portfolioId: p.id, sourceType: e.sourceType, sourceId: e.sourceId } },
      create: { portfolioId: p.id, type: e.type, title: e.title, summary: e.summary, sourceType: e.sourceType, sourceId: e.sourceId, verified: true, occurredAt: new Date() },
      update: { summary: e.summary, title: e.title },
    });
  } catch (err) {
    console.error("portfolio entry failed", err);
  }
}
