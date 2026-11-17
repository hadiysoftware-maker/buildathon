import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { KvGrid, PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Student · Campus 2035" };

const tone = (s: string) => (s === "ACTIVE" ? "ok" : s === "SUSPENDED" || s === "INACTIVE" ? "warn" : "bad");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePagePermission("students.manage");
  const { id } = await params; // the student's user id
  const user = await prisma.user.findFirst({
    where: { id, institutionId: s.institutionId, student: { isNot: null } },
    include: {
      student: {
        include: {
          department: { select: { name: true } },
          course: { select: { id: true, name: true } },
          enrollments: {
            orderBy: { enrolledAt: "desc" },
            include: { division: { include: { class: { select: { id: true, name: true } } } }, academicYear: { select: { name: true } } },
          },
        },
      },
      credentials: { orderBy: { issuedAt: "desc" }, take: 5 },
      authLogs: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, result: true, portal: true, createdAt: true } },
    },
  });
  if (!user?.student) notFound();
  const st = user.student;
  const current = st.enrollments.find((e) => e.status === "ACTIVE");
  const card = user.credentials[0];

  return (
    <PageWrap>
      <PageHeader
        eyebrow={<Link href="/admin/people/students">← Students</Link>}
        title={user.fullName}
        description={`${st.studentCode} · ${st.admissionNumber}${user.archivedAt ? " · archived" : ""}`}
      />
      <KvGrid items={[
        { label: "Status", value: <PillChip tone={tone(user.status)}>{user.status.toLowerCase()}</PillChip> },
        { label: "Class", value: current ? <Link href={`/admin/academic/divisions/${current.divisionId}`}>{current.division.class.name} · {current.division.name}</Link> : "Not enrolled" },
        { label: "Roll number", value: current?.rollNumber ?? "—" },
        { label: "Course", value: st.course ? <Link href={`/admin/academic/courses/${st.course.id}`}>{st.course.name}</Link> : "—" },
        { label: "Department", value: st.department?.name ?? "—" },
        { label: "Smart ID", value: card ? <PillChip tone={tone(card.status)}>{card.status.toLowerCase()} · #{card.cardNumber}</PillChip> : <PillChip tone="neutral">none</PillChip> },
        { label: "Last sign-in", value: user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "Never" },
      ]} />

      <SectionCard title="Personal and guardian details" icon="user">
        <KvGrid items={[
          { label: "Email", value: user.email ?? "—" },
          { label: "Phone", value: st.phone ?? "—" },
          { label: "Date of birth", value: st.dateOfBirth ? fmtDate(st.dateOfBirth) : "—" },
          { label: "Admission date", value: st.admissionDate ? fmtDate(st.admissionDate) : "—" },
          { label: "Guardian", value: st.guardianName ? `${st.guardianName}${st.guardianRelation ? ` (${st.guardianRelation})` : ""}` : "—" },
          { label: "Guardian phone", value: st.guardianPhone ?? "—" },
        ]} />
        <p className="cd-muted" style={{ marginTop: 12 }}>Edit these on the <Link href="/admin/people/students">Students</Link> list. Manage the card on <Link href="/admin/smart-id">Smart ID cards</Link>.</p>
      </SectionCard>

      <SectionCard title="Enrollment history" icon="history">
        {st.enrollments.length === 0 ? <p className="cd-muted">Never enrolled.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Enrollment history">
              <thead><tr><th>Year</th><th>Class</th><th>Division</th><th>Roll</th><th>Status</th><th>From</th></tr></thead>
              <tbody>
                {st.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>{e.academicYear.name}</td>
                    <td><Link href={`/admin/academic/classes/${e.division.class.id}`}>{e.division.class.name}</Link></td>
                    <td>{e.division.name}</td>
                    <td>{e.rollNumber ?? "—"}</td>
                    <td><PillChip tone={e.status === "ACTIVE" ? "ok" : "neutral"}>{e.status.toLowerCase()}</PillChip></td>
                    <td>{fmtDate(e.enrolledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Cards and recent sign-ins" icon="qr">
        <div className="dk-table-wrap">
          <table className="dk-table" aria-label="Recent sign-ins">
            <thead><tr><th>When</th><th>Result</th><th>Portal</th></tr></thead>
            <tbody>
              {user.authLogs.length === 0 ? <tr><td colSpan={3} className="cd-muted">No sign-in attempts yet.</td></tr> : user.authLogs.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDateTime(l.createdAt)}</td>
                  <td><PillChip tone={l.result === "SUCCESS" ? "ok" : "bad"}>{l.result.toLowerCase().replace(/_/g, " ")}</PillChip></td>
                  <td>{l.portal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageWrap>
  );
}
