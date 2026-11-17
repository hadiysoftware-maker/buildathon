import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { SmartIdManager } from "@/features/smart-id/SmartIdManager";

export const metadata = { title: "Smart ID cards · Campus 2035" };

export default async function Page() {
  const s = await requirePagePermission("smartid.manage");
  const users = await prisma.user.findMany({
    where: { institutionId: s.institutionId, status: "ACTIVE", OR: [{ student: { isNot: null } }, { teacher: { isNot: null } }] },
    orderBy: { fullName: "asc" },
    take: 1000,
    include: {
      student: { select: { studentCode: true } },
      teacher: { select: { teacherCode: true } },
      credentials: { orderBy: { issuedAt: "desc" }, take: 1 },
      authLogs: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, result: true, method: true, portal: true, createdAt: true } },
    },
  });
  return (
    <SmartIdManager
      rows={users.map((u) => {
        const c = u.credentials[0];
        return {
          id: u.id,
          name: u.fullName,
          code: u.student?.studentCode ?? u.teacher?.teacherCode ?? "",
          role: u.student ? ("Student" as const) : ("Teacher" as const),
          credentialId: c?.id ?? null,
          cardStatus: c?.status ?? null,
          cardNumber: c?.cardNumber ?? null,
          issuedAt: c?.issuedAt.toISOString() ?? null,
          lastUsedAt: c?.lastUsedAt?.toISOString() ?? null,
          logs: u.authLogs.map((l) => ({ id: l.id, result: l.result, method: l.method, portal: l.portal, at: l.createdAt.toISOString() })),
        };
      })}
    />
  );
}
