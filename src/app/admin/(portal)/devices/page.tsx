import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { DevicesManager } from "@/features/smart-id/DevicesManager";

export const metadata = { title: "Devices · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("devices.manage");
  const inst = { institutionId: s.institutionId };
  const [devices, students, setting] = await Promise.all([
    prisma.registeredDevice.findMany({ where: inst, orderBy: { createdAt: "desc" }, include: { assignedStudent: { include: { user: { select: { fullName: true } } } } } }),
    prisma.studentProfile.findMany({ where: { ...inst, user: { status: "ACTIVE" } }, include: { user: { select: { fullName: true } } }, orderBy: { user: { fullName: "asc" } }, take: 1000 }),
    prisma.institutionSetting.findUnique({ where: { institutionId_key: { institutionId: s.institutionId, key: "requireEnrolledDevice" } } }),
  ]);
  return (
    <DevicesManager
      requireEnrolled={setting?.value === true}
      canPolicy={hasPermission(s.role, "institution.manage")}
      students={students.map((x) => ({ value: x.id, label: `${x.user.fullName} (${x.studentCode})` }))}
      rows={devices.map((d) => ({
        id: d.id, assetTag: d.assetTag, label: d.label, status: d.status, assignedTo: d.assignedStudent?.user.fullName ?? null,
        enrolledAt: d.enrolledAt?.toISOString() ?? null, lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      }))}
    />
  );
}
