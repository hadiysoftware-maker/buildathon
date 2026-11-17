import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { TeachersManager } from "@/features/people/clients";

export const metadata = { title: "Teachers · Campus 2035" };

export default async function Page() {
  const s = await requirePagePermission("teachers.manage");
  const inst = { institutionId: s.institutionId };
  const [teachers, departments] = await Promise.all([
    prisma.user.findMany({
      where: { ...inst, teacher: { isNot: null }, status: { not: "ARCHIVED" } },
      orderBy: { fullName: "asc" },
      take: 1000,
      include: { teacher: { include: { department: { select: { name: true } } } }, credentials: { orderBy: { issuedAt: "desc" }, take: 1, select: { status: true } } },
    }),
    prisma.department.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  return (
    <TeachersManager
      departments={departments.map((d) => ({ value: d.id, label: d.name }))}
      rows={teachers.map((u) => {
        const t = u.teacher!;
        return {
          id: u.id, name: u.fullName, teacherCode: t.teacherCode, employeeId: t.employeeId, email: u.email, phone: t.phone,
          departmentId: t.departmentId, department: t.department?.name ?? null, qualification: t.qualification, designation: t.designation,
          specialization: t.specialization, status: u.status as "ACTIVE" | "INACTIVE" | "ARCHIVED", cardStatus: u.credentials[0]?.status ?? null,
        };
      })}
    />
  );
}
