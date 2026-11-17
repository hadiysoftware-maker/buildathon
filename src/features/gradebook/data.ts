import "server-only";
import { prisma } from "@/lib/db";

export interface GradeRow { studentId: string; userId: string; name: string; code: string; assignmentPct: number | null; assignments: number; quizPct: number | null; quizzes: number; attendancePct: number | null }

/** Released marks, quiz average and 30-day attendance for every active student of one division. Caller must have checked access to the division. */
export async function gradebookFor(institutionId: string, divisionId: string): Promise<GradeRow[]> {
  const enr = await prisma.enrollment.findMany({
    where: { divisionId, status: "ACTIVE", student: { institutionId } },
    select: { student: { select: { id: true, userId: true, studentCode: true, user: { select: { fullName: true } } } } },
    orderBy: { student: { user: { fullName: "asc" } } },
  });
  if (!enr.length) return [];
  const ids = enr.map((e) => e.student.id);
  const users = enr.map((e) => e.student.userId);
  const since = new Date(Date.now() - 30 * 86400000);
  const [grades, attempts, att] = await Promise.all([
    prisma.grade.findMany({ where: { status: "RELEASED", submission: { studentId: { in: ids }, assignment: { divisionId } } }, select: { marks: true, submission: { select: { studentId: true, assignment: { select: { maxMarks: true } } } } } }),
    prisma.practiceAttempt.groupBy({ by: ["userId"], where: { userId: { in: users }, institutionId, source: "QUIZ" }, _sum: { score: true, total: true }, _count: { _all: true } }),
    prisma.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: ids }, date: { gte: since } }, _count: { _all: true } }),
  ]);
  const gBy = new Map<string, number[]>();
  for (const g of grades) {
    const max = Number(g.submission.assignment.maxMarks);
    if (!max) continue;
    const l = gBy.get(g.submission.studentId) ?? [];
    l.push((Number(g.marks) / max) * 100);
    gBy.set(g.submission.studentId, l);
  }
  const qBy = new Map(attempts.map((a) => [a.userId, a]));
  const aBy = new Map<string, { here: number; all: number }>();
  for (const a of att) {
    if (a.status === "EXCUSED") continue;
    const x = aBy.get(a.studentId) ?? { here: 0, all: 0 };
    x.all += a._count._all;
    if (a.status === "PRESENT" || a.status === "LATE") x.here += a._count._all;
    aBy.set(a.studentId, x);
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return enr.map(({ student: st }) => {
    const g = gBy.get(st.id) ?? [];
    const q = qBy.get(st.userId);
    const a = aBy.get(st.id);
    return {
      studentId: st.id, userId: st.userId, name: st.user.fullName, code: st.studentCode,
      assignmentPct: g.length ? r1(g.reduce((x, y) => x + y, 0) / g.length) : null, assignments: g.length,
      quizPct: q && q._sum.total ? r1(((q._sum.score ?? 0) / q._sum.total) * 100) : null, quizzes: q?._count._all ?? 0,
      attendancePct: a && a.all ? r1((a.here / a.all) * 100) : null,
    };
  });
}

/** A teacher may open a division only if they teach in it. */
export async function teachesDivision(userId: string, divisionId: string) {
  const t = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!t) return false;
  return (await prisma.teacherAssignment.count({ where: { teacherId: t.id, divisionId } })) > 0;
}
