"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { action, UserError } from "../shared";
import { notify } from "../notify";
import { addPortfolio } from "../portfolio/record";
import { studentOf, teacherOf } from "../assignments/context";
import { readStart, signStart } from "./token";

const PATHS = ["/teacher/quizzes", "/student/quizzes", "/teacher", "/student"];

const QIn = z.object({
  id: z.string().max(30).optional(),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
  prompt: z.string().trim().min(1, "Every question needs text").max(2000),
  options: z.array(z.object({ label: z.string().trim().min(1, "Options cannot be empty").max(500), isCorrect: z.boolean() })).max(6).default([]),
  correctAnswer: z.string().trim().max(500).optional(),
  explanation: z.string().trim().max(1000).optional(),
  points: z.coerce.number().min(0.5).max(100).default(1),
});
export type QuizQuestionInput = z.input<typeof QIn>;

const Save = z.object({
  id: z.string().max(30).optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  subjectId: z.string().min(1, "Choose a subject").max(30),
  divisionId: z.string().min(1, "Choose a class").max(30),
  timeLimitMin: z.coerce.number().int().min(0).max(240).default(0),
  randomize: z.boolean().default(false),
  showLeaderboard: z.boolean().default(false),
  scheduledFor: z.string().optional(),
  questions: z.array(QIn).min(1, "Add at least one question").max(50),
  publish: z.boolean().default(false),
  source: z.enum(["MANUAL", "AI_GENERATED"]).default("MANUAL"),
});
export type SaveQuizInput = z.input<typeof Save>;

function check(q: z.output<typeof QIn>, n: number) {
  if (q.type === "SHORT_ANSWER") {
    if (!q.correctAnswer) throw new UserError(`Question ${n}: add the correct answer.`);
    return;
  }
  const opts = q.type === "TRUE_FALSE" ? [{ label: "True", isCorrect: q.options[0]?.isCorrect ?? false }, { label: "False", isCorrect: q.options[1]?.isCorrect ?? false }] : q.options;
  if (opts.length < 2) throw new UserError(`Question ${n}: add at least two options.`);
  if (opts.filter((o) => o.isCorrect).length !== 1) throw new UserError(`Question ${n}: mark exactly one correct option.`);
}

async function ownQuiz(id: string, institutionId: string, userId: string) {
  const q = await prisma.quiz.findFirst({ where: { id, institutionId, createdById: userId } });
  if (!q) throw new UserError("Quiz not found.");
  return q;
}

export async function saveQuiz(input: SaveQuizInput) {
  return action("quiz.manage", async (s) => {
    const d = Save.parse(input);
    const teacherId = await teacherOf(s);
    const teaches = await prisma.teacherAssignment.count({ where: { teacherId, subjectId: d.subjectId, divisionId: d.divisionId } });
    if (!teaches) throw new UserError("You can only set quizzes for a subject and class you teach.");
    d.questions.forEach((q, i) => check(q, i + 1));
    const scheduled = d.scheduledFor ? new Date(d.scheduledFor) : null;
    if (scheduled && Number.isNaN(scheduled.getTime())) throw new UserError("Choose a valid start time.");

    const build = (q: z.output<typeof QIn>) => {
      const options = q.type === "TRUE_FALSE"
        ? [{ label: "True", isCorrect: q.options[0]?.isCorrect ?? false }, { label: "False", isCorrect: q.options[1]?.isCorrect ?? false }]
        : q.type === "SHORT_ANSWER" ? [] : q.options;
      return {
        institutionId: s.institutionId, subjectId: d.subjectId, type: q.type, prompt: q.prompt, explanation: q.explanation || null,
        correctAnswer: q.type === "SHORT_ANSWER" ? q.correctAnswer : null, source: d.source, createdById: s.userId,
        options: { create: options.map((o, i) => ({ label: o.label, isCorrect: o.isCorrect, sequence: i + 1 })) },
      };
    };

    let id = d.id;
    if (id) {
      const prev = await ownQuiz(id, s.institutionId, s.userId);
      const answered = await prisma.quizResponse.count({ where: { quizSession: { quizId: id } } });
      if (answered) throw new UserError("Students have already answered this quiz, so its questions cannot be changed.");
      await prisma.$transaction(async (tx) => {
        await tx.quizQuestion.deleteMany({ where: { quizId: id! } });
        await tx.quiz.update({ where: { id: id! }, data: { title: d.title, subjectId: d.subjectId, divisionId: d.divisionId, timeLimitSec: d.timeLimitMin ? d.timeLimitMin * 60 : null, randomize: d.randomize, showLeaderboard: d.showLeaderboard, scheduledFor: scheduled } });
        for (const [i, q] of d.questions.entries()) {
          const created = await tx.question.create({ data: build(q) });
          await tx.quizQuestion.create({ data: { quizId: id!, questionId: created.id, sequence: i + 1, points: q.points } });
        }
      });
      void prev;
    } else {
      const quiz = await prisma.quiz.create({
        data: { institutionId: s.institutionId, title: d.title, subjectId: d.subjectId, divisionId: d.divisionId, createdById: s.userId, timeLimitSec: d.timeLimitMin ? d.timeLimitMin * 60 : null, randomize: d.randomize, showLeaderboard: d.showLeaderboard, scheduledFor: scheduled, status: "DRAFT" },
      });
      id = quiz.id;
      for (const [i, q] of d.questions.entries()) {
        const created = await prisma.question.create({ data: build(q) });
        await prisma.quizQuestion.create({ data: { quizId: id, questionId: created.id, sequence: i + 1, points: q.points } });
      }
    }
    if (d.publish) await publishQuiz(s.institutionId, id, d.title, d.divisionId);
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: d.id ? "quiz.update" : "quiz.create", entityType: "Quiz", entityId: id });
    return { id };
  }, PATHS);
}

async function publishQuiz(institutionId: string, id: string, title: string, divisionId: string | null) {
  await prisma.quiz.update({ where: { id }, data: { status: "PUBLISHED" } });
  const open = await prisma.quizSession.findFirst({ where: { quizId: id, status: { in: ["LIVE", "SCHEDULED"] } } });
  if (!open) await prisma.quizSession.create({ data: { quizId: id, status: "LIVE", startedAt: new Date() } });
  else if (open.status !== "LIVE") await prisma.quizSession.update({ where: { id: open.id }, data: { status: "LIVE", startedAt: new Date() } });
  if (divisionId) {
    const rows = await prisma.enrollment.findMany({ where: { divisionId, status: "ACTIVE" }, select: { student: { select: { userId: true } } } });
    await notify(institutionId, rows.map((r) => r.student.userId), { type: "quiz.new", title: `New quiz: ${title}`, link: `/student/quizzes/${id}` });
  }
}

export async function setQuizState(id: string, state: "PUBLISH" | "CLOSE" | "UNPUBLISH" | "ARCHIVE") {
  return action("quiz.manage", async (s) => {
    const q = await ownQuiz(id, s.institutionId, s.userId);
    if (state === "PUBLISH") await publishQuiz(s.institutionId, id, q.title, q.divisionId);
    else if (state === "CLOSE") await prisma.quizSession.updateMany({ where: { quizId: id, status: { not: "CLOSED" } }, data: { status: "CLOSED", closedAt: new Date() } });
    else if (state === "UNPUBLISH") {
      if (await prisma.quizResponse.count({ where: { quizSession: { quizId: id } } })) throw new UserError("Students have answered already. Close the quiz instead.");
      await prisma.quiz.update({ where: { id }, data: { status: "DRAFT" } });
      await prisma.quizSession.deleteMany({ where: { quizId: id } });
    } else await prisma.quiz.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: `quiz.${state.toLowerCase()}`, entityType: "Quiz", entityId: id });
  }, PATHS);
}

export async function deleteQuiz(id: string) {
  return action("quiz.manage", async (s) => {
    await ownQuiz(id, s.institutionId, s.userId);
    if (await prisma.quizResponse.count({ where: { quizSession: { quizId: id } } })) {
      await prisma.quiz.update({ where: { id }, data: { status: "ARCHIVED" } });
      await prisma.quizSession.updateMany({ where: { quizId: id, status: { not: "CLOSED" } }, data: { status: "CLOSED", closedAt: new Date() } });
    } else {
      await prisma.quizSession.deleteMany({ where: { quizId: id } });
      await prisma.quiz.delete({ where: { id } });
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "quiz.delete", entityType: "Quiz", entityId: id });
  }, PATHS);
}

/** Student loads the quiz. Correct answers are never sent. Returns a signed start ticket for the timer. */
export async function startQuiz(quizId: string) {
  return action("quiz.take", async (s) => {
    const { studentId, divisionId } = await studentOf(s);
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, institutionId: s.institutionId, status: "PUBLISHED", OR: [{ divisionId }, { divisionId: null }] },
      include: { questions: { orderBy: { sequence: "asc" }, include: { question: { include: { options: { orderBy: { sequence: "asc" }, select: { id: true, label: true } } } } } } },
    });
    if (!quiz) throw new UserError("This quiz is not available.");
    if (quiz.scheduledFor && quiz.scheduledFor > new Date()) throw new UserError("This quiz has not started yet.");
    const session = await prisma.quizSession.findFirst({ where: { quizId, status: "LIVE" }, orderBy: { startedAt: "desc" } });
    if (!session) throw new UserError("This quiz is closed.");
    if (await prisma.quizResponse.count({ where: { quizSessionId: session.id, studentId } })) throw new UserError("You have already taken this quiz.");
    let qs = quiz.questions.map((x) => ({ id: x.questionId, type: x.question.type, prompt: x.question.prompt, points: Number(x.points), options: x.question.options }));
    if (quiz.randomize) qs = qs.map((q) => ({ q, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.q);
    return { title: quiz.title, timeLimitSec: quiz.timeLimitSec, token: signStart(quizId, s.userId), questions: qs };
  }, []);
}

const Answers = z.array(z.object({ questionId: z.string().max(30), optionId: z.string().max(30).optional(), text: z.string().max(1000).optional() })).max(60);

export async function submitQuiz(quizId: string, token: string, answers: z.input<typeof Answers>) {
  return action("quiz.take", async (s) => {
    const ans = Answers.parse(answers);
    const { studentId, divisionId } = await studentOf(s);
    const startedAt = readStart(quizId, s.userId, token);
    if (startedAt === null) throw new UserError("Please reopen the quiz and try again.");
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, institutionId: s.institutionId, status: "PUBLISHED", OR: [{ divisionId }, { divisionId: null }] },
      include: { questions: { include: { question: { include: { options: true } } } } },
    });
    if (!quiz) throw new UserError("This quiz is not available.");
    const session = await prisma.quizSession.findFirst({ where: { quizId, status: "LIVE" }, orderBy: { startedAt: "desc" } });
    if (!session) throw new UserError("This quiz was closed before you finished.");
    if (quiz.timeLimitSec && Date.now() - startedAt > (quiz.timeLimitSec + 20) * 1000) throw new UserError("Time is up. Your answers were not accepted.");

    let score = 0;
    let total = 0;
    const rows = quiz.questions.map((qq) => {
      const q = qq.question;
      const given = ans.find((a) => a.questionId === q.id);
      const points = Number(qq.points);
      total += points;
      let correct: boolean | null = false;
      if (q.type === "SHORT_ANSWER") {
        const norm = (v?: string | null) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
        correct = !!given?.text && norm(given.text) === norm(q.correctAnswer);
      } else {
        const opt = q.options.find((o) => o.id === given?.optionId);
        correct = !!opt?.isCorrect;
      }
      if (correct) score += points;
      return { quizSessionId: session.id, questionId: q.id, studentId, answer: given?.text ?? null, selectedOptionId: q.type === "SHORT_ANSWER" ? null : q.options.some((o) => o.id === given?.optionId) ? given?.optionId ?? null : null, isCorrect: correct, score: correct ? points : 0 };
    });
    try {
      await prisma.quizResponse.createMany({ data: rows });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new UserError("You have already taken this quiz.");
      throw e;
    }
    await addPortfolio(studentId, { type: "QUIZ", title: quiz.title, summary: `Scored ${score} / ${total}`, sourceType: "QuizSession", sourceId: `${session.id}:${studentId}` });
    await prisma.practiceAttempt.create({
      data: { institutionId: s.institutionId, userId: s.userId, studentId, topic: quiz.title, score: Math.round(score), total: Math.round(total), source: "QUIZ", answers: rows.map((r) => ({ questionId: r.questionId, isCorrect: r.isCorrect })) },
    }).catch((e) => console.error("practice attempt failed", e));
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "quiz.submit", entityType: "Quiz", entityId: quizId });
    return { score, total };
  }, ["/student/quizzes", "/teacher/quizzes", "/student/portfolio"]);
}
