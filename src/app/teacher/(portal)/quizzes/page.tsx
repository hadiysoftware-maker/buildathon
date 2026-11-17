import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { TeacherQuizzes, type QuizRow } from "@/features/quizzes/TeacherQuizzes";
import { teachingPairs } from "@/features/assignments/context";

export const metadata = { title: "Quizzes · EduCore" };

export default async function Page() {
  const s = await requirePagePermission("quiz.manage", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const [pairs, quizzes] = await Promise.all([
    t ? teachingPairs(t.id) : [],
    prisma.quiz.findMany({
      where: { institutionId: s.institutionId, createdById: s.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } },
        questions: { orderBy: { sequence: "asc" }, include: { question: { include: { options: { orderBy: { sequence: "asc" } } } } } },
        sessions: { select: { status: true, responses: { select: { studentId: true, score: true } } } },
      },
    }),
  ]);
  const seen = new Set<string>();
  const rows: QuizRow[] = quizzes.map((q) => {
    const total = q.questions.reduce((n, x) => n + Number(x.points), 0);
    const by = new Map<string, number>();
    for (const ses of q.sessions) for (const r of ses.responses) by.set(r.studentId, (by.get(r.studentId) ?? 0) + Number(r.score ?? 0));
    const avg = by.size && total ? Math.round(([...by.values()].reduce((a, b) => a + b, 0) / by.size / total) * 100) : null;
    return {
      id: q.id, title: q.title, subjectId: q.subjectId, divisionId: q.divisionId ?? "", subject: q.subject.name,
      division: q.division ? `${q.division.class.name} ${q.division.name}` : "All", timeLimitMin: q.timeLimitSec ? Math.round(q.timeLimitSec / 60) : 0,
      randomize: q.randomize, showLeaderboard: q.showLeaderboard, scheduledFor: q.scheduledFor?.toISOString() ?? null, status: q.status,
      open: q.sessions.some((x) => x.status === "LIVE"), takers: by.size, avgPct: avg,
      questions: q.questions.map((x) => ({
        type: x.question.type as "MULTIPLE_CHOICE", prompt: x.question.prompt, explanation: x.question.explanation ?? "", correctAnswer: x.question.correctAnswer ?? "", points: Number(x.points),
        options: x.question.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
      })),
    };
  });
  return (
    <TeacherQuizzes
      rows={rows}
      pairs={pairs.filter((p) => !seen.has(`${p.subjectId}|${p.divisionId}`) && seen.add(`${p.subjectId}|${p.divisionId}`)).map((p) => ({ subjectId: p.subjectId, divisionId: p.divisionId, label: `${p.division.class.name} ${p.division.name} — ${p.subject.name}` }))}
    />
  );
}
