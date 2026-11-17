import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Assignments · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const enr = st ? await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } }) : null;
  const list = enr && st
    ? await prisma.assignment.findMany({
        where: { institutionId: s.institutionId, divisionId: enr.divisionId, status: { in: ["PUBLISHED", "CLOSED"] } },
        orderBy: { dueAt: "asc" },
        include: { subject: { select: { name: true } }, submissions: { where: { studentId: st.id }, orderBy: { attempt: "desc" }, take: 1, include: { grade: true } } },
      })
    : [];
  const now = new Date();
  const rows = list.map((a) => {
    const sub = a.submissions[0];
    const released = sub?.grade?.status === "RELEASED" ? Number(sub.grade.marks) : null;
    const redo = sub?.status === "RESUBMIT_REQUESTED";
    const state = redo ? "redo" : released !== null ? "graded" : sub ? "submitted" : a.status === "CLOSED" || (a.dueAt < now && !a.allowLate) ? "missed" : a.dueAt < now ? "overdue" : "todo";
    return { a, state, released };
  });
  const groups: { title: string; icon: "clock" | "done" | "checkSquare"; items: typeof rows }[] = [
    { title: "To do", icon: "clock", items: rows.filter((r) => ["todo", "overdue", "redo"].includes(r.state)) },
    { title: "Submitted", icon: "checkSquare", items: rows.filter((r) => r.state === "submitted") },
    { title: "Graded", icon: "done", items: rows.filter((r) => r.state === "graded") },
    { title: "Missed", icon: "clock", items: rows.filter((r) => r.state === "missed") },
  ];
  const tone = (st: string) => (st === "graded" ? "ok" : st === "submitted" ? "neutral" : st === "missed" || st === "overdue" ? "danger" : "warn");

  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="Assignments" description="Work set by your teachers. Submit before the deadline and see your marks once they are released." />
      {rows.length === 0 ? <EmptyState title="No assignments yet" hint={enr ? "When a teacher publishes work for your class it will show up here." : "You are not enrolled in a class yet."} /> : groups.filter((g) => g.items.length).map((g) => (
        <SectionCard key={g.title} title={g.title} icon={g.icon} count={g.items.length}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {g.items.map(({ a, state, released }) => (
              <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span style={{ display: "grid" }}>
                  <Link href={`/student/assignments/${a.id}`}><strong>{a.title}</strong></Link>
                  <small className="cd-muted">{a.subject.name} · due {fmtDateTime(a.dueAt)}</small>
                </span>
                <PillChip tone={tone(state)}>{state === "graded" ? `${released} / ${Number(a.maxMarks)}` : state === "redo" ? "redo requested" : state}</PillChip>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </PageWrap>
  );
}
