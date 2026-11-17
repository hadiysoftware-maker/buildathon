import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { KvGrid, PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { DAY_SHORT } from "@/lib/format";

export const metadata = { title: "Division · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePagePermission("academic.manage");
  const { id } = await params;
  const div = await prisma.division.findFirst({
    where: { id, institutionId: s.institutionId },
    include: {
      class: { select: { id: true, name: true, academicYearId: true, course: { select: { name: true } }, academicYear: { select: { name: true } } } },
      classTeacher: { include: { user: { select: { fullName: true } } } },
      classroom: { select: { name: true } },
    },
  });
  if (!div) notFound();

  const [students, assignments, entries, periods] = await Promise.all([
    prisma.enrollment.findMany({
      where: { divisionId: id, status: "ACTIVE" },
      orderBy: { rollNumber: "asc" },
      include: { student: { include: { user: { select: { fullName: true, status: true, credentials: { orderBy: { issuedAt: "desc" }, take: 1, select: { status: true } } } } } } },
    }),
    prisma.teacherAssignment.findMany({
      where: { divisionId: id },
      include: { subject: { select: { id: true, name: true } }, teacher: { include: { user: { select: { fullName: true } } } } },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.timetableEntry.findMany({
      where: { divisionId: id, status: "ACTIVE", academicYearId: div.class.academicYearId },
      include: { subject: { select: { name: true } } },
    }),
    prisma.period.findMany({ where: { institutionId: s.institutionId, archivedAt: null, kind: "CLASS" }, orderBy: { sequence: "asc" } }),
  ]);
  const days = [1, 2, 3, 4, 5];

  return (
    <PageWrap>
      <PageHeader
        eyebrow={<Link href={`/admin/academic/classes/${div.class.id}`}>← {div.class.name}</Link>}
        title={`${div.class.name} · Division ${div.name}`}
        description={`${div.class.course.name} · ${div.class.academicYear.name}${div.archivedAt ? " · archived" : ""}`}
      />
      <KvGrid items={[
        { label: "Enrolled", value: `${students.length} / ${div.capacity}` },
        { label: "Class teacher", value: div.classTeacher?.user.fullName ?? "—" },
        { label: "Home classroom", value: div.classroom?.name ?? "—" },
        { label: "Subjects", value: assignments.length },
        { label: "Lessons / week", value: entries.length },
      ]} />

      <SectionCard title="Weekly timetable" icon="calendar" subtitle="Edit it in the timetable builder.">
        {entries.length === 0 ? <p className="cd-muted">No timetable has been built for this division yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Division timetable">
              <thead><tr><th>Period</th>{days.map((d) => <th key={d}>{DAY_SHORT[d]}</th>)}</tr></thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><small className="cd-muted">{p.startTime}–{p.endTime}</small></td>
                    {days.map((d) => <td key={d}>{entries.find((e) => e.periodId === p.id && e.dayOfWeek === d)?.subject.name ?? <span className="cd-muted">—</span>}</td>)}
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
              <thead><tr><th>Subject</th><th>Teacher</th></tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}><td><Link href={`/admin/academic/subjects/${a.subject.id}`}>{a.subject.name}</Link></td><td>{a.teacher.user.fullName}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Students" icon="students" count={students.length}>
        {students.length === 0 ? <p className="cd-muted">No students are enrolled in this division.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Students">
              <thead><tr><th>Roll</th><th>Name</th><th>Code</th><th>Smart ID</th></tr></thead>
              <tbody>
                {students.map((e) => (
                  <tr key={e.id}>
                    <td>{e.rollNumber ?? "—"}</td>
                    <td><Link href={`/admin/people/students/${e.student.userId}`}>{e.student.user.fullName}</Link></td>
                    <td>{e.student.studentCode}</td>
                    <td>{e.student.user.credentials[0]?.status.toLowerCase() ?? "none"}</td>
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
