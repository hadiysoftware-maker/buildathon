import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { SubjectsManager } from "@/features/academic/clients";

export const metadata = { title: "Subjects · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const [subjects, depts] = await Promise.all([
    prisma.subject.findMany({ where: { institutionId: s.institutionId, archivedAt: null }, orderBy: { code: "asc" }, include: { department: { select: { name: true } } } }),
    prisma.department.findMany({ where: { institutionId: s.institutionId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  return (
    <SubjectsManager
      rows={subjects.map((x) => ({ id: x.id, code: x.code, name: x.name, departmentId: x.departmentId, departmentName: x.department?.name ?? null, type: x.type, credits: Number(x.credits), periodsPerWeek: x.periodsPerWeek }))}
      departments={depts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
    />
  );
}
