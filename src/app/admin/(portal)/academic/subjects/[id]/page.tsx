import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { KvGrid, PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";

export const metadata = { title: "Subject · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePagePermission("academic.manage");
  const { id } = await params;
  const subject = await prisma.subject.findFirst({
    where: { id, institutionId: s.institutionId },
    include: {
      department: { select: { code: true, name: true } },
      courses: { include: { course: { select: { id: true, code: true, name: true } } }, orderBy: { yearLevel: "asc" } },
    },
  });
  if (!subject) notFound();

  const year = await prisma.academicYear.findFirst({ where: { institutionId: s.institutionId, status: "ACTIVE" }, select: { id: true, name: true } });
  const [assignments, scheduled] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: { subjectId: id, division: { institutionId: s.institutionId, archivedAt: null } },
      include: { division: { include: { class: { select: { name: true } } } }, teacher: { include: { user: { select: { fullName: true } } } } },
      orderBy: [{ division: { class: { name: "asc" } } }, { division: { name: "asc" } }],
    }),
    year ? prisma.timetableEntry.count({ where: { subjectId: id, academicYearId: year.id, status: "ACTIVE" } }) : Promise.resolve(0),
  ]);
  const teachers = new Map(assignments.map((a) => [a.teacherId, a.teacher.user.fullName]));

  return (
    <PageWrap>
      <PageHeader
        eyebrow={<Link href="/admin/academic/subjects">← Subjects</Link>}
        title={subject.name}
        description={`${subject.code}${subject.department ? ` · ${subject.department.name}` : ""}${subject.archivedAt ? " · archived" : ""}`}
      />
      <KvGrid items={[
        { label: "Code", value: subject.code },
        { label: "Type", value: subject.type.toLowerCase() },
        { label: "Credits", value: String(subject.credits) },
        { label: "Periods / week", value: subject.periodsPerWeek },
        { label: "Divisions teaching it", value: assignments.length },
        { label: `Lessons in timetable${year ? ` (${year.name})` : ""}`, value: scheduled },
      ]} />

      <SectionCard title="Who teaches it" icon="teacher" subtitle={`${teachers.size} teacher${teachers.size === 1 ? "" : "s"}`}>
        {assignments.length === 0 ? <p className="cd-muted">No teacher is assigned to this subject yet. Assign one under Classes.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Teaching assignments">
              <thead><tr><th>Class</th><th>Division</th><th>Teacher</th></tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.division.class.name}</td>
                    <td><Link href={`/admin/academic/divisions/${a.divisionId}`}>{a.division.name}</Link></td>
                    <td>{a.teacher.user.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Courses" icon="courses" subtitle="Courses that include this subject.">
        {subject.courses.length === 0 ? <p className="cd-muted">Not linked to any course.</p> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {subject.courses.map((c) => (
              <Link key={c.courseId} href={`/admin/academic/courses/${c.courseId}`}><PillChip tone="brand">{c.course.code} · level {c.yearLevel}</PillChip></Link>
            ))}
          </div>
        )}
      </SectionCard>
    </PageWrap>
  );
}
