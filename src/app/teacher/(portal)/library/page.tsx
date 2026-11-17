import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { storageConfigured } from "@/lib/storage/r2";
import { TeacherLibrary } from "@/features/library/TeacherLibrary";

export const metadata = { title: "Library · Campus 2035" };

export default async function Page() {
  const s = await requirePagePermission("library.manage", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const [assigned, materials] = await Promise.all([
    t ? prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { subject: { select: { id: true, code: true, name: true } } }, distinct: ["subjectId"] }) : [],
    prisma.learningMaterial.findMany({ where: { institutionId: s.institutionId, createdById: s.userId }, orderBy: { createdAt: "desc" }, take: 200, include: { subject: { select: { name: true } } } }),
  ]);
  return (
    <TeacherLibrary
      storageReady={storageConfigured()}
      subjects={assigned.map((a) => ({ value: a.subject.id, label: `${a.subject.code} — ${a.subject.name}` }))}
      rows={materials.map((m) => ({ id: m.id, title: m.title, subject: m.subject.name, type: m.type, status: m.status, fileId: m.fileId, createdAt: m.createdAt.toISOString() }))}
    />
  );
}
