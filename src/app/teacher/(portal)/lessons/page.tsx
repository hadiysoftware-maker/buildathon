import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { LessonLogger, type Slot } from "@/features/lessons/LessonLogger";
import { teachingPairs } from "@/features/assignments/context";

export const metadata = { title: "Lesson log · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("classroom.teach", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [pairs, entries, logs, past] = t
    ? await Promise.all([
        teachingPairs(t.id),
        prisma.timetableEntry.findMany({ where: { teacherId: t.id, status: "ACTIVE", dayOfWeek: new Date().getDay() }, include: { period: { select: { name: true, startTime: true, endTime: true, sequence: true } } }, orderBy: { period: { sequence: "asc" } } }),
        prisma.lessonLog.findMany({ where: { teacherId: t.id, date: today } }),
        prisma.lessonLog.findMany({ where: { teacherId: t.id, date: { lt: today } }, orderBy: { date: "desc" }, take: 12 }),
      ])
    : [[], [], [], []];
  const label = new Map(pairs.map((p) => [`${p.divisionId}|${p.subjectId}`, `${p.division.class.name} ${p.division.name} · ${p.subject.name}`]));
  const logged = new Map(logs.map((l) => [`${l.divisionId}|${l.subjectId}`, l]));
  const seen = new Set<string>();
  const slots: Slot[] = [];
  for (const e of entries) {
    const k = `${e.divisionId}|${e.subjectId}`;
    if (seen.has(k) || !label.has(k)) continue;
    seen.add(k);
    const l = logged.get(k);
    slots.push({ key: k, divisionId: e.divisionId, subjectId: e.subjectId, label: label.get(k)!, time: `${e.period.startTime} to ${e.period.endTime}`, logged: l ? { id: l.id, topic: l.topic, homework: l.homework } : null });
  }
  for (const p of pairs) {
    const k = `${p.divisionId}|${p.subjectId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const l = logged.get(k);
    slots.push({ key: k, divisionId: p.divisionId, subjectId: p.subjectId, label: label.get(k)!, logged: l ? { id: l.id, topic: l.topic, homework: l.homework } : null });
  }
  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Lesson log" description="Record what you taught today. Students' Nova uses it to answer “what did we learn today?” and to explain the topic." />
      <SectionCard title="Today" icon="calendar" count={slots.length}>
        <LessonLogger slots={slots} past={past.map((p) => ({ id: p.id, label: label.get(`${p.divisionId}|${p.subjectId}`) ?? "Class", date: p.date.toISOString().slice(0, 10), topic: p.topic }))} />
      </SectionCard>
    </PageWrap>
  );
}
