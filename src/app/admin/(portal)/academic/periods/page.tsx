import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PeriodsManager } from "@/features/academic/clients";

export const metadata = { title: "Periods · Campus 2035" };

export default async function Page() {
  const s = await requirePagePermission("academic.manage");
  const rows = await prisma.period.findMany({ where: { institutionId: s.institutionId, archivedAt: null }, orderBy: { sequence: "asc" } });
  const next = (rows.at(-1)?.sequence ?? 0) + 1;
  return <PeriodsManager rows={rows.map((p) => ({ id: p.id, name: p.name, sequence: p.sequence, startTime: p.startTime, endTime: p.endTime, kind: p.kind }))} nextSequence={next} />;
}
