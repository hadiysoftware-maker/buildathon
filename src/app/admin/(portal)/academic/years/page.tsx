import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { YearsManager } from "@/features/academic/clients";

export const metadata = { title: "Academic years · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const rows = await prisma.academicYear.findMany({
    where: { institutionId: s.institutionId },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, status: true },
  });
  return <YearsManager rows={rows} />;
}
