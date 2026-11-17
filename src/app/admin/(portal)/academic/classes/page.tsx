import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { ClassesManager } from "@/features/academic/clients";

export const metadata = { title: "Classes · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const inst = { institutionId: s.institutionId };
  const [classes, divisions, assignments, courses, years, subjects, teachers, rooms] = await Promise.all([
    prisma.class.findMany({
      where: { ...inst, archivedAt: null },
      orderBy: [{ academicYear: { startDate: "desc" } }, { name: "asc" }],
      include: { course: { select: { name: true } }, academicYear: { select: { name: true } }, divisions: { where: { archivedAt: null }, select: { name: true }, orderBy: { name: "asc" } } },
    }),
    prisma.division.findMany({
      where: { ...inst, archivedAt: null, class: { archivedAt: null } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      include: {
        class: { select: { name: true } },
        classTeacher: { include: { user: { select: { fullName: true } } } },
        classroom: { select: { name: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.teacherAssignment.findMany({
      where: { division: { ...inst, archivedAt: null } },
      include: { division: { include: { class: { select: { name: true } } } }, subject: { select: { name: true, code: true } }, teacher: { include: { user: { select: { fullName: true } } } } },
      orderBy: [{ division: { class: { name: "asc" } } }, { subject: { name: "asc" } }],
    }),
    prisma.course.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ where: { ...inst, status: { not: "ARCHIVED" } }, orderBy: { startDate: "desc" } }),
    prisma.subject.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.teacherProfile.findMany({ where: { ...inst, user: { status: "ACTIVE" } }, include: { user: { select: { fullName: true } } }, orderBy: { user: { fullName: "asc" } } }),
    prisma.classroom.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  const divLabel = (d: (typeof divisions)[number]) => `${d.class.name} · Div ${d.name}`;
  const teacherOpts = teachers.map((t) => ({ value: t.id, label: t.user.fullName }));
  return (
    <ClassesManager
      classes={classes.map((c) => ({ id: c.id, name: c.name, courseName: c.course.name, yearName: c.academicYear.name, yearLevel: c.yearLevel, divisions: c.divisions.map((d) => d.name).join(", ") }))}
      divisions={divisions.map((d) => ({ id: d.id, classId: d.classId, label: divLabel(d), name: d.name, capacity: d.capacity, enrolled: d._count.enrollments, classTeacherId: d.classTeacherId, classTeacherName: d.classTeacher?.user.fullName ?? null, classroomId: d.classroomId, classroomName: d.classroom?.name ?? null }))}
      assignments={assignments.map((a) => ({ id: a.id, division: divLabel(a.division as never), subject: `${a.subject.code} — ${a.subject.name}`, teacher: a.teacher.user.fullName }))}
      courses={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
      years={years.map((y) => ({ value: y.id, label: y.name }))}
      classOptions={classes.map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear.name})` }))}
      divisionOptions={divisions.map((d) => ({ value: d.id, label: divLabel(d) }))}
      subjects={subjects.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))}
      teachers={teacherOpts}
      classrooms={rooms.map((r) => ({ value: r.id, label: r.name }))}
    />
  );
}
