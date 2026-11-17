import "server-only";
import { prisma } from "@/lib/db";

const day = (d: Date) => d.toISOString().slice(0, 10);
export const todayUtc = () => new Date(day(new Date()) + "T00:00:00.000Z");

/** What a class has been taught recently (newest first). Teacher-authored and shared with the class, so students may read it. */
export async function recentLessons(divisionId: string, days = 14, take = 12) {
  const since = new Date(todayUtc().getTime() - days * 86400000);
  const rows = await prisma.lessonLog.findMany({ where: { divisionId, date: { gte: since } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take });
  if (!rows.length) return [];
  const subs = await prisma.subject.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.subjectId))] } }, select: { id: true, name: true } });
  const by = new Map(subs.map((x) => [x.id, x.name]));
  const today = day(todayUtc());
  return rows.map((r) => ({ subject: by.get(r.subjectId) ?? "Subject", topic: r.topic, summary: r.summary, homework: r.homework, date: day(r.date), today: day(r.date) === today }));
}

/** Subjects of a division with the teacher who teaches each. */
export async function subjectsWithTeachers(divisionId: string) {
  const rows = await prisma.teacherAssignment.findMany({ where: { divisionId }, select: { subject: { select: { name: true } }, teacher: { select: { user: { select: { fullName: true } } } } } });
  return rows.map((r) => ({ subject: r.subject.name, teacher: r.teacher.user.fullName }));
}

export function lessonsPrompt(l: Awaited<ReturnType<typeof recentLessons>>): string {
  if (!l.length) return "No lessons have been logged by the teachers recently, so you do not know what was taught today. If asked, say so kindly and offer to explain the topic if they tell you what it is.";
  const line = (x: (typeof l)[number]) => `${x.today ? "TODAY" : x.date} ${x.subject}: ${x.topic}${x.summary ? ` (${x.summary})` : ""}${x.homework ? ` Homework: ${x.homework}` : ""}`;
  return `What the teachers logged for this class recently (use it when asked about lessons, homework or "what was taught"):\n${l.map(line).join("\n")}`;
}
