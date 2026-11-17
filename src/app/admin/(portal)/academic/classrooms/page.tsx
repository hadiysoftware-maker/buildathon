import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { ClassroomsManager } from "@/features/academic/clients";

export const metadata = { title: "Classrooms · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const rows = await prisma.classroom.findMany({ where: { institutionId: s.institutionId, archivedAt: null }, orderBy: { code: "asc" } });
  return <ClassroomsManager rows={rows.map((r) => ({ id: r.id, code: r.code, name: r.name, building: r.building, capacity: r.capacity, hasSmartBoard: r.hasSmartBoard }))} />;
}
