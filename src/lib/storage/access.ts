import "server-only";
import { prisma } from "@/lib/db";
import type { CurrentSession } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";

/** Whether this session may read the stored file. Default deny: a file nobody links to is readable only by admins. */
export async function canReadFile(s: CurrentSession, file: { id: string; institutionId: string; objectKey: string; uploadedById?: string | null }): Promise<boolean> {
  if (file.institutionId !== s.institutionId) return false;
  // Copilot attachments are private to the person who uploaded them, admins included.
  if (file.objectKey.startsWith(`${file.institutionId}/chat/`)) return file.uploadedById === s.userId;
  if (isAdminRole(s.role)) return true;

  // Profile photos are shown across the app to signed-in people of the same institution.
  const avatar = await prisma.user.count({ where: { institutionId: s.institutionId, photoKey: file.id } });
  if (avatar > 0) return true;

  // Assignment work: the uploader, the teacher who owns the assignment, and (for attachments) students of its division.
  if (file.objectKey.startsWith(`${file.institutionId}/work/`)) {
    if (file.uploadedById === s.userId) return true;
    if (s.role === "TEACHER") {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!t) return false;
      const [att, sub] = await Promise.all([
        prisma.assignmentAttachment.count({ where: { fileId: file.id, assignment: { teacherId: t.id } } }),
        prisma.submissionFile.count({ where: { fileId: file.id, submission: { assignment: { teacherId: t.id } } } }),
      ]);
      return att + sub > 0;
    }
    if (s.role === "STUDENT") {
      const enr = await prisma.enrollment.findFirst({ where: { status: "ACTIVE", student: { userId: s.userId } }, select: { divisionId: true } });
      if (!enr) return false;
      return (await prisma.assignmentAttachment.count({ where: { fileId: file.id, assignment: { status: { in: ["PUBLISHED", "CLOSED"] }, divisionId: enr.divisionId } } })) > 0;
    }
    return false;
  }

  const materials = await prisma.learningMaterial.findMany({
    where: { fileId: file.id, institutionId: s.institutionId },
    select: { status: true, subjectId: true, createdById: true },
  });
  if (materials.length === 0) return false;
  if (s.role === "TEACHER") return true;

  if (s.role === "STUDENT") {
    const enr = await prisma.enrollment.findFirst({ where: { status: "ACTIVE", student: { userId: s.userId } }, select: { divisionId: true } });
    if (!enr) return false;
    for (const m of materials) {
      if (m.status !== "PUBLISHED") continue;
      const ok = await prisma.teacherAssignment.count({ where: { divisionId: enr.divisionId, subjectId: m.subjectId } });
      if (ok > 0) return true;
    }
  }
  return false;
}
