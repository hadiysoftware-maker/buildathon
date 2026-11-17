import { StudentGrid } from "@/features/portfolio/StudentGrid";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";

export const metadata = { title: "Student portfolios · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("portfolio.view.any", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const divisions = t ? (await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { divisionId: true }, distinct: ["divisionId"] })).map((d) => d.divisionId) : [];
  const rows = divisions.length
    ? await prisma.enrollment.findMany({
        where: { divisionId: { in: divisions }, status: "ACTIVE", student: { institutionId: s.institutionId } },
        select: { student: { select: { id: true, studentCode: true, user: { select: { fullName: true } }, portfolio: { select: { _count: { select: { entries: true } } } } } }, division: { select: { name: true, class: { select: { name: true } } } } },
        orderBy: { student: { user: { fullName: "asc" } } },
      })
    : [];
  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Student portfolios" description="Read-only view of the students in your classes. Open one to verify self-reported entries." />
      <SectionCard title="Students" icon="graduation" count={rows.length}>
        {rows.length === 0 ? <p className="cd-muted">No students in your classes yet.</p> : (
          <StudentGrid hrefBase="/teacher/portfolio" rows={rows.map((r) => ({ id: r.student.id, name: r.student.user.fullName, code: r.student.studentCode, cls: `${r.division.class.name} ${r.division.name}`, entries: r.student.portfolio?._count.entries ?? 0 }))} />
        )}
      </SectionCard>
    </PageWrap>
  );
}
