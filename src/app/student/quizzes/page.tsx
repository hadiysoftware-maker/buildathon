import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Quizzes · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const enr = st ? await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } }) : null;
  const list = st && enr
    ? await prisma.quiz.findMany({
        where: { institutionId: s.institutionId, status: "PUBLISHED", OR: [{ divisionId: enr.divisionId }, { divisionId: null }] },
        orderBy: { createdAt: "desc" },
        include: {
          subject: { select: { name: true } }, questions: { select: { points: true } },
          sessions: { select: { status: true, responses: { where: { studentId: st.id }, select: { score: true } } } },
        },
      })
    : [];
  const now = new Date();
  const rows = list.map((q) => {
    const total = q.questions.reduce((n, x) => n + Number(x.points), 0);
    const mine = q.sessions.flatMap((x) => x.responses);
    const done = mine.length > 0;
    const score = mine.reduce((n, r) => n + Number(r.score ?? 0), 0);
    const live = q.sessions.some((x) => x.status === "LIVE");
    const soon = !!q.scheduledFor && q.scheduledFor > now;
    return { q, total, done, score, state: done ? "done" : soon ? "soon" : live ? "open" : "closed" };
  });
  const groups = [
    { title: "Open now", icon: "quiz" as const, items: rows.filter((r) => r.state === "open") },
    { title: "Coming up", icon: "clock" as const, items: rows.filter((r) => r.state === "soon") },
    { title: "Completed", icon: "done" as const, items: rows.filter((r) => r.state === "done") },
    { title: "Closed", icon: "clock" as const, items: rows.filter((r) => r.state === "closed") },
  ];
  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="Quizzes" description="Timed quizzes from your teachers. You get your score and explanations as soon as you finish." />
      {rows.length === 0 ? <EmptyState title="No quizzes yet" hint={enr ? "When a teacher publishes a quiz for your class it will show up here." : "You are not enrolled in a class yet."} /> : groups.filter((g) => g.items.length).map((g) => (
        <SectionCard key={g.title} title={g.title} icon={g.icon} count={g.items.length}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {g.items.map(({ q, total, score, state }) => (
              <li key={q.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span style={{ display: "grid" }}>
                  <strong>{q.title}</strong>
                  <small className="cd-muted">{q.subject.name} · {q.questions.length} questions{q.timeLimitSec ? ` · ${Math.round(q.timeLimitSec / 60)} min` : ""}{state === "soon" && q.scheduledFor ? ` · opens ${fmtDateTime(q.scheduledFor)}` : ""}</small>
                </span>
                {state === "open" && <Link className="ds-btn sm" href={`/student/quizzes/${q.id}`}>Start</Link>}
                {state === "done" && <span style={{ display: "flex", gap: 8, alignItems: "center" }}><PillChip tone="ok">{score} / {total}</PillChip>{q.showLeaderboard && <Link className="ds-btn outline sm" href={`/student/quizzes/${q.id}`}>Leaderboard</Link>}</span>}
                {state === "soon" && <PillChip tone="warn">scheduled</PillChip>}
                {state === "closed" && <PillChip tone="neutral">closed</PillChip>}
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </PageWrap>
  );
}
