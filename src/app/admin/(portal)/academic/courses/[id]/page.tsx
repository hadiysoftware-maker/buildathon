import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { KvGrid, PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Course · Campus 2035" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePagePermission("academic.manage");
  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: { id, institutionId: s.institutionId },
    include: {
      department: { select: { id: true, name: true, code: true } },
      classes: {
        where: { archivedAt: null },
        orderBy: [{ academicYear: { startDate: "desc" } }, { yearLevel: "asc" }],
        include: { academicYear: { select: { name: true, status: true } }, divisions: { where: { archivedAt: null }, orderBy: { name: "asc" }, include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } } },
      },
      subjects: { include: { subject: { select: { id: true, code: true, name: true, type: true } } }, orderBy: [{ yearLevel: "asc" }] },
      _count: { select: { students: true } },
    },
  });
  if (!course) notFound();
  const enrolled = course.classes.flatMap((c) => c.divisions).reduce((n, d) => n + d._count.enrollments, 0);

  return (
    <PageWrap>
      <PageHeader
        eyebrow={<Link href="/admin/academic/courses">← Courses</Link>}
        title={course.name}
        description={`${course.code} · ${course.department.name}${course.archivedAt ? " · archived" : ""}`}
      />
      <KvGrid items={[
        { label: "Code", value: course.code },
        { label: "Department", value: `${course.department.code} — ${course.department.name}` },
        { label: "Duration", value: `${course.durationYears} year${course.durationYears === 1 ? "" : "s"}` },
        { label: "Students admitted", value: course._count.students },
        { label: "Currently enrolled", value: enrolled },
        { label: "Created", value: fmtDate(course.createdAt) },
      ]} />

      <SectionCard title="Classes" icon="courses" subtitle="Cohorts of this course by academic year.">
        {course.classes.length === 0 ? <p className="cd-muted">No classes yet. Create one under Classes.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Classes of this course">
              <thead><tr><th>Class</th><th>Year</th><th>Level</th><th>Divisions</th></tr></thead>
              <tbody>
                {course.classes.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/academic/classes/${c.id}`}><strong>{c.name}</strong></Link></td>
                    <td>{c.academicYear.name} {c.academicYear.status === "ACTIVE" && <PillChip tone="ok">active</PillChip>}</td>
                    <td>{c.yearLevel}</td>
                    <td>{c.divisions.length ? c.divisions.map((d, i) => (<span key={d.id}>{i > 0 && ", "}<Link href={`/admin/academic/divisions/${d.id}`}>{d.name}</Link> ({d._count.enrollments}/{d.capacity})</span>)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Subjects" icon="read" subtitle="Subjects linked to this course by year level.">
        {course.subjects.length === 0 ? <p className="cd-muted">No subjects are linked to this course.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Course subjects">
              <thead><tr><th>Code</th><th>Subject</th><th>Type</th><th>Level</th></tr></thead>
              <tbody>
                {course.subjects.map((x) => (
                  <tr key={x.subjectId}>
                    <td><PillChip tone="brand">{x.subject.code}</PillChip></td>
                    <td><Link href={`/admin/academic/subjects/${x.subjectId}`}>{x.subject.name}</Link></td>
                    <td>{x.subject.type.toLowerCase()}</td>
                    <td>{x.yearLevel}</td>
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
