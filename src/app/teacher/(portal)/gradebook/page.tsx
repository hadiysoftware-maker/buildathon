import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { gradebookFor } from "@/features/gradebook/data";
import { teachingPairs } from "@/features/assignments/context";

export const metadata = { title: "Gradebook · EduCore" };

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const s = await requirePagePermission("assignments.manage", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const pairs = t ? await teachingPairs(t.id) : [];
  const divs = [...new Map(pairs.map((p) => [p.divisionId, `${p.division.class.name} ${p.division.name}`])).entries()];
  const sel = (await searchParams).d;
  const divisionId = divs.find(([id]) => id === sel)?.[0] ?? divs[0]?.[0];
  const rows = divisionId ? await gradebookFor(s.institutionId, divisionId) : [];
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Gradebook" description="Released assignment marks, quiz average and 30-day attendance for each student. Marks you have not released are not counted." />
      <SectionCard title="Class" icon="graduation" count={rows.length}>
        <div className="gb-bar">
          <div className="sg-chips" role="group" aria-label="Choose class">
            {divs.map(([id, name]) => <Link key={id} href={`/teacher/gradebook?d=${id}`} className="gb-chip" data-on={id === divisionId ? "1" : "0"}>{name}</Link>)}
          </div>
          {divisionId && <a className="ds-btn tonal sm" href={`/api/gradebook?division=${divisionId}&format=xlsx`}>Download Excel</a>}
        </div>
        {rows.length === 0 ? <p className="cd-muted">No students yet.</p> : (
          <div className="gb-wrap">
            <table className="gb">
              <thead><tr><th>Student</th><th>Assignments</th><th>Quizzes</th><th>Attendance</th><th><span className="sr-only">Report card</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td><Link href={`/teacher/portfolio/${r.studentId}`}><b>{r.name}</b></Link><small>{r.code}</small></td>
                    <td>{pct(r.assignmentPct)}<small>{r.assignments} graded</small></td>
                    <td>{pct(r.quizPct)}<small>{r.quizzes} taken</small></td>
                    <td>{pct(r.attendancePct)}</td>
                    <td><a href={`/api/gradebook?division=${divisionId}&format=docx&student=${r.studentId}`}>Report card</a></td>
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
