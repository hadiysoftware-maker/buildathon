import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { KvGrid, PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";

export const metadata = { title: "Class · Campus 2035" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePagePermission("academic.manage");
  const { id } = await params;
  const cls = await prisma.class.findFirst({
    where: { id, institutionId: s.institutionId },
    include: {
      course: { select: { id: true, code: true, name: true } },
      academicYear: { select: { name: true, status: true } },
      divisions: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        include: {
          classTeacher: { include: { user: { select: { fullName: true } } } },
          classroom: { select: { name: true } },
          _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
  if (!cls) notFound();

  const divisionIds = cls.divisions.map((d) => d.id);
  const [assignments, students] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: { divisionId: { in: divisionIds } },
      include: { subject: { select: { id: true, code: true, name: true } }, teacher: { include: { user: { select: { fullName: true } } } }, division: { select: { name: true } } },
      orderBy: [{ subject: { name: "asc" } }, { division: { name: "asc" } }],
    }),
    prisma.enrollment.findMany({
      where: { divisionId: { in: divisionIds }, status: "ACTIVE" },
      orderBy: [{ divisionId: "asc" }, { rollNumber: "asc" }],
      take: 200,
      include: { student: { include: { user: { select: { fullName: true } } } }, division: { select: { name: true } } },
    }),
  ]);
  const enrolled = cls.divisions.reduce((n, d) => n + d._count.enrollments, 0);
  const capacity = cls.divisions.reduce((n, d) => n + d.capacity, 0);

  return (
    <PageWrap>
      <PageHeader
        eyebrow={<Link href="/admin/academic/classes">← Classes</Link>}
        title={cls.name}
        description={`${cls.course.name} · ${cls.academicYear.name}${cls.archivedAt ? " · archived" : ""}`}
      />
      <KvGrid items={[
        { label: "Course", value: <Link href={`/admin/academic/courses/${cls.course.id}`}>{cls.course.code}</Link> },
        { label: "Academic year", value: <>{cls.academicYear.name} {cls.academicYear.status === "ACTIVE" && <PillChip tone="ok">active</PillChip>}</> },
        { label: "Year level", value: cls.yearLevel },
        { label: "Divisions", value: cls.divisions.length },
        { label: "Students", value: `${enrolled} / ${capacity || "—"}` },
        { label: "Teaching assignments", value: assignments.length },
      ]} />

      <SectionCard title="Divisions" icon="group" subtitle="Sections where students are enrolled.">
        {cls.divisions.length === 0 ? <p className="cd-muted">No divisions yet. Add one under Classes → Divisions.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Divisions">
              <thead><tr><th>Division</th><th>Enrolled</th><th>Class teacher</th><th>Home room</th></tr></thead>
              <tbody>
                {cls.divisions.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/admin/academic/divisions/${d.id}`}><strong>Division {d.name}</strong></Link></td>
                    <td>{d._count.enrollments} / {d.capacity}</td>
                    <td>{d.classTeacher?.user.fullName ?? "—"}</td>
                    <td>{d.classroom?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Subjects and teachers" icon="read">
        {assignments.length === 0 ? <p className="cd-muted">No teachers are assigned yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Subjects and teachers">
              <thead><tr><th>Subject</th><th>Division</th><th>Teacher</th></tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/admin/academic/subjects/${a.subject.id}`}>{a.subject.name}</Link></td>
                    <td>{a.division.name}</td>
                    <td>{a.teacher.user.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Students" icon="students" count={students.length}>
        {students.length === 0 ? <p className="cd-muted">No students are enrolled in this class.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Students">
              <thead><tr><th>Roll</th><th>Name</th><th>Code</th><th>Division</th></tr></thead>
              <tbody>
                {students.map((e) => (
                  <tr key={e.id}>
                    <td>{e.rollNumber ?? "—"}</td>
                    <td><Link href={`/admin/people/students/${e.student.userId}`}>{e.student.user.fullName}</Link></td>
                    <td>{e.student.studentCode}</td>
                    <td>{e.division.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageWrap>
  );
}
