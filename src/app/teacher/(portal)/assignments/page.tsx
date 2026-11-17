import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { storageConfigured } from "@/lib/storage/r2";
import { TeacherAssignments } from "@/features/assignments/TeacherAssignments";
import { teachingPairs } from "@/features/assignments/context";

export const metadata = { title: "Assignments · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("assignments.manage", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const [pairs, list] = await Promise.all([
    t ? teachingPairs(t.id) : [],
    t
      ? prisma.assignment.findMany({
          where: { institutionId: s.institutionId, teacherId: t.id },
          orderBy: { dueAt: "desc" },
          take: 200,
          include: { subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } }, submissions: { select: { studentId: true, grade: { select: { id: true } } } } },
        })
      : [],
  ]);
  const sizes = list.length
    ? await prisma.enrollment.groupBy({ by: ["divisionId"], where: { status: "ACTIVE", divisionId: { in: [...new Set(list.map((a) => a.divisionId))] } }, _count: { _all: true } })
    : [];
  const size = new Map(sizes.map((x) => [x.divisionId, x._count._all]));
  const seen = new Set<string>();
  return (
    <TeacherAssignments
      storageReady={storageConfigured()}
      pairs={pairs.filter((p) => !seen.has(`${p.subjectId}|${p.divisionId}`) && seen.add(`${p.subjectId}|${p.divisionId}`)).map((p) => ({ subjectId: p.subjectId, divisionId: p.divisionId, label: `${p.division.class.name} ${p.division.name} — ${p.subject.name}` }))}
      rows={list.map((a) => {
        const students = new Set(a.submissions.map((x) => x.studentId));
        return {
          id: a.id, title: a.title, instructions: a.instructions, subjectId: a.subjectId, divisionId: a.divisionId, subject: a.subject.name,
          division: `${a.division.class.name} ${a.division.name}`, submissionType: a.submissionType, maxMarks: Number(a.maxMarks), dueAt: a.dueAt.toISOString(),
          allowLate: a.allowLate, allowResubmission: a.allowResubmission, status: a.status, submitted: students.size,
          graded: a.submissions.filter((x) => x.grade).length, total: size.get(a.divisionId) ?? 0,
        };
      })}
    />
  );
}
