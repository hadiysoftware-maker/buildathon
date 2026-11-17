import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { TimetableBuilder } from "@/features/timetable/TimetableBuilder";

export const metadata = { title: "Timetable · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("timetable.manage");
  const inst = { institutionId: s.institutionId };
  const active = await prisma.academicYear.findFirst({ where: { ...inst, status: "ACTIVE" } });
  const [periods, divisions, teachers, rooms, subjects, entries, setting] = await Promise.all([
    prisma.period.findMany({ where: { ...inst, archivedAt: null }, orderBy: { sequence: "asc" } }),
    prisma.division.findMany({
      where: { ...inst, archivedAt: null, class: { archivedAt: null, ...(active ? { academicYearId: active.id } : {}) } },
      include: { class: { select: { name: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.teacherProfile.findMany({ where: { ...inst, user: { status: "ACTIVE" } }, include: { user: { select: { fullName: true } } }, orderBy: { user: { fullName: "asc" } } }),
    prisma.classroom.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
    active
      ? prisma.timetableEntry.findMany({
          where: { ...inst, academicYearId: active.id },
          include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { fullName: true } } } }, classroom: { select: { name: true } }, division: { include: { class: { select: { name: true } } } } },
        })
      : [],
    prisma.institutionSetting.findUnique({ where: { institutionId_key: { institutionId: s.institutionId, key: "workingDays" } } }),
  ]);

  if (!active) {
    return (
      <div className="ds-emptystate">
        <h2>Activate an academic year first</h2>
        <p>The timetable belongs to the active academic year. Create and activate one under Academic years.</p>
      </div>
    );
  }
  const workingDays = Array.isArray(setting?.value) && (setting.value as unknown[]).every((n) => typeof n === "number") ? (setting.value as number[]) : [1, 2, 3, 4, 5];

  return (
    <TimetableBuilder
      workingDays={workingDays}
      periods={periods.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime, endTime: p.endTime, kind: p.kind }))}
      divisions={divisions.map((d) => ({ value: d.id, label: `${d.class.name} · Div ${d.name}` }))}
      teachers={teachers.map((t) => ({ value: t.id, label: t.user.fullName }))}
      classrooms={rooms.map((r) => ({ value: r.id, label: r.name }))}
      subjects={subjects.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))}
      entries={entries.map((e) => ({
        id: e.id, divisionId: e.divisionId, dayOfWeek: e.dayOfWeek, periodId: e.periodId, subjectId: e.subjectId, subjectName: e.subject.name,
        teacherId: e.teacherId, teacherName: e.teacher.user.fullName, classroomId: e.classroomId, classroomName: e.classroom?.name ?? null,
        divisionLabel: `${e.division.class.name} · ${e.division.name}`, status: e.status,
      }))}
    />
  );
}
