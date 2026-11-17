import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";

export const metadata = { title: "Quiz results · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePagePermission("quiz.manage", "/teacher/login");
  const q = await prisma.quiz.findFirst({
    where: { id, institutionId: s.institutionId, createdById: s.userId },
    include: {
      subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } },
      questions: { orderBy: { sequence: "asc" }, include: { question: { select: { id: true, prompt: true } } } },
      sessions: { include: { responses: { include: { student: { select: { studentCode: true, user: { select: { fullName: true } } } } } } } },
    },
  });
  if (!q) notFound();

  const total = q.questions.reduce((n, x) => n + Number(x.points), 0);
  const responses = q.sessions.flatMap((x) => x.responses);
  const per = new Map<string, { name: string; code: string; score: number }>();
  for (const r of responses) {
    const cur = per.get(r.studentId) ?? { name: r.student.user.fullName, code: r.student.studentCode, score: 0 };
    cur.score += Number(r.score ?? 0);
    per.set(r.studentId, cur);
  }
  const board = [...per.values()].sort((a, b) => b.score - a.score);
  const acc = q.questions.map((x) => {
    const rs = responses.filter((r) => r.questionId === x.questionId);
    return { prompt: x.question.prompt, pct: rs.length ? Math.round((rs.filter((r) => r.isCorrect).length / rs.length) * 100) : null, n: rs.length };
  });
  const avg = board.length && total ? Math.round((board.reduce((n, b) => n + b.score, 0) / board.length / total) * 100) : null;

  return (
    <PageWrap>
      <PageHeader eyebrow={<Link href="/teacher/quizzes">← Quizzes</Link>} title={q.title} description={`${q.division ? `${q.division.class.name} ${q.division.name}` : "All classes"} · ${q.subject.name} · ${q.questions.length} questions · ${total} points`}
        actions={<PillChip tone={q.status === "PUBLISHED" ? "ok" : "neutral"}>{q.status.toLowerCase()}</PillChip>} />
      <SectionCard title="Summary" icon="chart">
        <p style={{ margin: 0 }}>{board.length} student{board.length === 1 ? "" : "s"} took this quiz{avg !== null ? ` · class average ${avg}%` : ""}.</p>
      </SectionCard>
      <SectionCard title="Question accuracy" icon="quiz" count={acc.length}>
        <div style={{ display: "grid", gap: 10 }}>
          {acc.map((a, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{i + 1}. {a.prompt}</span><strong>{a.pct === null ? "—" : `${a.pct}%`}</strong></div>
              <div aria-hidden="true" style={{ height: 8, borderRadius: 8, background: "var(--md-surface-container, #e8efed)" }}>
                <div style={{ width: `${a.pct ?? 0}%`, height: "100%", borderRadius: 8, background: (a.pct ?? 0) >= 60 ? "var(--md-primary, #0F766E)" : "#d97706" }} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Scores" icon="trophy" count={board.length}>
        {board.length === 0 ? <p className="cd-muted">No attempts yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Scores">
              <thead><tr><th>#</th><th>Student</th><th>Score</th><th>Percent</th></tr></thead>
              <tbody>{board.map((b, i) => <tr key={b.code}><td>{i + 1}</td><td>{b.name} <small className="cd-muted">{b.code}</small></td><td>{b.score} / {total}</td><td>{total ? Math.round((b.score / total) * 100) : 0}%</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageWrap>
  );
}
