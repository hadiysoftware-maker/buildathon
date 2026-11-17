import "server-only";
import { prisma } from "@/lib/db";

export interface PracticeSummary {
  attempts: number; average: number | null; best: number | null; last: { topic: string; score: number; total: number; at: string } | null;
  trend: { label: string; value: number }[]; topics: { topic: string; attempts: number; pct: number }[]; weak: string[]; strong: string[];
}

/** Strictly the caller's own attempts. `userId` always comes from the session, never from the model. */
export async function practiceSummary(userId: string, institutionId: string, limit = 30): Promise<PracticeSummary> {
  const rows = await prisma.practiceAttempt.findMany({ where: { userId, institutionId }, orderBy: { createdAt: "desc" }, take: limit });
  const pct = (r: { score: number; total: number }) => (r.total ? Math.round((r.score / r.total) * 100) : 0);
  const byTopic = new Map<string, { n: number; s: number; t: number }>();
  for (const r of rows) {
    const k = r.topic.toLowerCase();
    const c = byTopic.get(k) ?? { n: 0, s: 0, t: 0 };
    c.n++; c.s += r.score; c.t += r.total;
    byTopic.set(k, c);
  }
  const topics = [...byTopic.entries()].map(([topic, c]) => ({ topic, attempts: c.n, pct: c.t ? Math.round((c.s / c.t) * 100) : 0 })).sort((a, b) => a.pct - b.pct);
  const chrono = [...rows].reverse();
  return {
    attempts: rows.length,
    average: rows.length ? Math.round(rows.reduce((n, r) => n + pct(r), 0) / rows.length) : null,
    best: rows.length ? Math.max(...rows.map(pct)) : null,
    last: rows[0] ? { topic: rows[0].topic, score: rows[0].score, total: rows[0].total, at: rows[0].createdAt.toISOString() } : null,
    trend: chrono.slice(-10).map((r) => ({ label: r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: pct(r) })),
    topics,
    weak: topics.filter((t) => t.pct < 60).slice(0, 3).map((t) => t.topic),
    strong: [...topics].reverse().filter((t) => t.pct >= 80).slice(0, 3).map((t) => t.topic),
  };
}
