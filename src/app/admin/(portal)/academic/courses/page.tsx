import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { CoursesManager } from "@/features/academic/clients";

export const metadata = { title: "Courses · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const [courses, depts] = await Promise.all([
    prisma.course.findMany({ where: { institutionId: s.institutionId, archivedAt: null }, orderBy: { code: "asc" }, include: { department: { select: { name: true } } } }),
    prisma.department.findMany({ where: { institutionId: s.institutionId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  return (
    <CoursesManager
      rows={courses.map((c) => ({ id: c.id, code: c.code, name: c.name, departmentId: c.departmentId, departmentName: c.department.name, durationYears: c.durationYears }))}
      departments={depts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
    />
  );
}
