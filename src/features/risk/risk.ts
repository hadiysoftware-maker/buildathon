import "server-only";
import { prisma } from "@/lib/db";

import { evaluateRisk } from "./rules";
export { evaluateRisk } from "./rules";

export interface AtRiskStudent { studentId: string; userId: string; name: string; code: string; cls: string; level: "high" | "watch"; reasons: string[] }

/** Students needing attention in the given divisions (all divisions of the school when omitted). Batched queries, no AI. */
export async function atRiskStudents(institutionId: string, divisionIds?: string[], limit = 20): Promise<AtRiskStudent[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", student: { institutionId }, ...(divisionIds ? { divisionId: { in: divisionIds } } : {}) },
    select: { divisionId: true, student: { select: { id: true, userId: true, studentCode: true, user: { select: { fullName: true } } } }, division: { select: { name: true, class: { select: { name: true } } } } },
    take: 2000,
  });
  if (!enrollments.length) return [];
  const studentIds = enrollments.map((e) => e.student.id);
  const userIds = enrollments.map((e) => e.student.userId);
  const divs = [...new Set(enrollments.map((e) => e.divisionId))];
  const since = new Date(Date.now() - 30 * 86400000);
  const now = new Date();
  const [att, attempts, assignments, subs] = await Promise.all([
    prisma.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: studentIds }, date: { gte: since } }, _count: { _all: true } }),
    prisma.practiceAttempt.findMany({ where: { userId: { in: userIds }, institutionId }, orderBy: { createdAt: "desc" }, select: { userId: true, score: true, total: true }, take: 6000 }),
    prisma.assignment.findMany({ where: { institutionId, divisionId: { in: divs }, status: "PUBLISHED", dueAt: { lt: now, gte: since } }, select: { id: true, divisionId: true } }),
    prisma.submission.findMany({ where: { studentId: { in: studentIds }, assignment: { status: "PUBLISHED", dueAt: { lt: now, gte: since } } }, select: { studentId: true, assignmentId: true } }),
  ]);
  const attBy = new Map<string, { here: number; all: number }>();
  for (const a of att) {
    const x = attBy.get(a.studentId) ?? { here: 0, all: 0 };
    if (a.status === "EXCUSED") continue;
    x.all += a._count._all;
    if (a.status === "PRESENT" || a.status === "LATE") x.here += a._count._all;
    attBy.set(a.studentId, x);
  }
  const quizBy = new Map<string, number[]>();
  for (const q of attempts) {
    if (!q.total) continue;
    const l = quizBy.get(q.userId) ?? [];
    l.push((q.score / q.total) * 100);
    quizBy.set(q.userId, l);
  }
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const doneBy = new Map<string, Set<string>>();
  for (const s of subs) { const x = doneBy.get(s.studentId) ?? new Set(); x.add(s.assignmentId); doneBy.set(s.studentId, x); }
  const out: AtRiskStudent[] = [];
  for (const e of enrollments) {
    const a = attBy.get(e.student.id);
    const q = quizBy.get(e.student.userId) ?? []; // newest first
    const due = assignments.filter((x) => x.divisionId === e.divisionId);
    const overdue = due.filter((x) => !doneBy.get(e.student.id)?.has(x.id)).length;
    const r = evaluateRisk({
      attendancePct: a && a.all ? (a.here / a.all) * 100 : null, attendanceDays: a?.all ?? 0,
      quizRecent: q.length >= 4 ? avg(q.slice(0, 3)) : null, quizEarlier: q.length >= 4 ? avg(q.slice(3, 6)) : null, overdue,
    });
    if (r.level) out.push({ studentId: e.student.id, userId: e.student.userId, name: e.student.user.fullName, code: e.student.studentCode, cls: `${e.division.class.name} ${e.division.name}`, level: r.level, reasons: r.reasons });
  }
  return out.sort((a, b) => (a.level === b.level ? b.reasons.length - a.reasons.length : a.level === "high" ? -1 : 1)).slice(0, limit);
}
