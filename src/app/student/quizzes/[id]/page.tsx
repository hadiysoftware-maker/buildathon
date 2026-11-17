import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { QuizTaker } from "@/features/quizzes/QuizTaker";

export const metadata = { title: "Quiz · EduCore" };
const L = ["A", "B", "C", "D", "E", "F"];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const enr = st ? await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } }) : null;
  const q = st && enr
    ? await prisma.quiz.findFirst({
        where: { id, institutionId: s.institutionId, status: "PUBLISHED", OR: [{ divisionId: enr.divisionId }, { divisionId: null }] },
        include: {
          subject: { select: { name: true } },
          questions: { orderBy: { sequence: "asc" }, include: { question: { include: { options: { orderBy: { sequence: "asc" } } } } } },
          sessions: { include: { responses: { include: { student: { select: { id: true, user: { select: { fullName: true } } } } } } } },
        },
      })
    : null;
  if (!q || !st) notFound();

  const all = q.sessions.flatMap((x) => x.responses);
  const mine = all.filter((r) => r.studentId === st.id);
  const total = q.questions.reduce((n, x) => n + Number(x.points), 0);
  const live = q.sessions.some((x) => x.status === "LIVE");

  if (mine.length === 0) {
    return (
      <PageWrap>
        <PageHeader eyebrow={<Link href="/student/quizzes">← Quizzes</Link>} title={q.title} description={q.subject.name} />
        {live && (!q.scheduledFor || q.scheduledFor <= new Date())
          ? <QuizTaker quizId={q.id} title={q.title} questionCount={q.questions.length} timeLimitMin={q.timeLimitSec ? Math.round(q.timeLimitSec / 60) : 0} />
          : <div className="cd-banner" data-tone="warn" role="status">This quiz is not open right now.</div>}
      </PageWrap>
    );
  }

  const score = mine.reduce((n, r) => n + Number(r.score ?? 0), 0);
  const per = new Map<string, { name: string; me: boolean; score: number }>();
  for (const r of all) {
    const cur = per.get(r.studentId) ?? { name: r.student.user.fullName, me: r.studentId === st.id, score: 0 };
    cur.score += Number(r.score ?? 0);
    per.set(r.studentId, cur);
  }
  const board = [...per.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  return (
    <PageWrap>
      <PageHeader eyebrow={<Link href="/student/quizzes">← Quizzes</Link>} title={q.title} description={q.subject.name} actions={<PillChip tone="ok">{score} / {total}</PillChip>} />
      <SectionCard title="Your answers" icon="quiz" count={q.questions.length}>
        <ol style={{ display: "grid", gap: 14, paddingLeft: 20, margin: 0 }}>
          {q.questions.map((x) => {
            const r = mine.find((m) => m.questionId === x.questionId);
            const right = x.question.options.findIndex((o) => o.isCorrect);
            const mineIdx = x.question.options.findIndex((o) => o.id === r?.selectedOptionId);
            return (
              <li key={x.questionId}>
                <strong>{x.question.prompt}</strong>
                <div><PillChip tone={r?.isCorrect ? "ok" : "danger"}>{r?.isCorrect ? "Correct" : "Not quite"}</PillChip></div>
                {x.question.type === "SHORT_ANSWER"
                  ? <small className="cd-muted">Your answer: {r?.answer || "—"} · Correct: {x.question.correctAnswer}</small>
                  : <small className="cd-muted">Your answer: {mineIdx >= 0 ? `${L[mineIdx]}. ${x.question.options[mineIdx].label}` : "—"} · Correct: {right >= 0 ? `${L[right]}. ${x.question.options[right].label}` : "—"}</small>}
                {x.question.explanation && <div><small>{x.question.explanation}</small></div>}
              </li>
            );
          })}
        </ol>
      </SectionCard>
      {q.showLeaderboard && (
        <SectionCard title="Leaderboard" icon="trophy">
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{board.map((b, i) => <li key={i} style={{ fontWeight: b.me ? 700 : 400 }}>{b.name}{b.me ? " (you)" : ""} — {b.score} / {total}</li>)}</ol>
        </SectionCard>
      )}
    </PageWrap>
  );
}
