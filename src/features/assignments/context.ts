import "server-only";
import { prisma } from "@/lib/db";
import { UserError } from "../shared";
import type { CurrentSession } from "@/lib/auth/session";

/** The signed-in teacher's profile id, or a friendly error. */
export async function teacherOf(s: CurrentSession) {
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  if (!t) throw new UserError("Only teachers can do this.");
  return t.id;
}

/** The signed-in student's profile id and current division, or a friendly error. */
export async function studentOf(s: CurrentSession) {
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  if (!st) throw new UserError("Only students can do this.");
  const enr = await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } });
  return { studentId: st.id, divisionId: enr?.divisionId ?? null };
}

/** Subject and division pairs this teacher is assigned to (current assignments). */
export async function teachingPairs(teacherId: string) {
  return prisma.teacherAssignment.findMany({
    where: { teacherId },
    select: { subjectId: true, divisionId: true, subject: { select: { code: true, name: true } }, division: { select: { name: true, class: { select: { name: true } } } } },
  });
}
