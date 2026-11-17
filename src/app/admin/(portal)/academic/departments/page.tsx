import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { DepartmentsManager } from "@/features/academic/clients";

export const metadata = { title: "Departments · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const [depts, teachers] = await Promise.all([
    prisma.department.findMany({
      where: { institutionId: s.institutionId, archivedAt: null },
      orderBy: { code: "asc" },
      include: { head: { include: { user: { select: { fullName: true } } } }, _count: { select: { courses: true, teachers: true } } },
    }),
    prisma.teacherProfile.findMany({ where: { institutionId: s.institutionId, user: { status: "ACTIVE" } }, include: { user: { select: { fullName: true } } }, orderBy: { user: { fullName: "asc" } } }),
  ]);
  return (
    <DepartmentsManager
      rows={depts.map((d) => ({ id: d.id, code: d.code, name: d.name, headTeacherId: d.headTeacherId, headName: d.head?.user.fullName ?? null, courses: d._count.courses, teachers: d._count.teachers }))}
      teachers={teachers.map((t) => ({ value: t.id, label: t.user.fullName }))}
    />
  );
}
