import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { recentLessons } from "@/lib/ai/lessons";

export interface HeroAction { label: string; prompt: string; hint?: string }

const AGENTS: Record<string, { name: string; blurb: string; prompt: string }[]> = {
  STUDENT: [
    { name: "Tutor", blurb: "Explains today's lessons simply", prompt: "Explain what we were taught today" },
    { name: "Quiz agent", blurb: "Practice that tracks your progress", prompt: "Quiz me on my weakest topic" },
    { name: "Slides agent", blurb: "Animated presentations with photos", prompt: "Make a presentation with images for my project" },
    { name: "Planner", blurb: "Revision plans from your deadlines", prompt: "Make me a revision plan for this week" },
  ],
  TEACHER: [
    { name: "Lesson agent", blurb: "Plans, worksheets and quizzes", prompt: "Plan a 40-minute lesson" },
    { name: "Grading agent", blurb: "Finds work to grade, drafts feedback", prompt: "What needs grading?" },
    { name: "Slides agent", blurb: "Animated decks with photos", prompt: "Make a presentation with images for my next class" },
    { name: "Sheets agent", blurb: "Mark sheets with live formulas", prompt: "Make a marks spreadsheet with formulas" },
  ],
  ADMIN: [
    { name: "Docs agent", blurb: "Circulars and reports in Word", prompt: "Draft a circular as a Word document" },
    { name: "Sheets agent", blurb: "Workload and attendance sheets", prompt: "Make a teacher workload spreadsheet" },
    { name: "Data agent", blurb: "Live school numbers and charts", prompt: "Give me a school overview" },
    { name: "Security agent", blurb: "Sign-ins and card status", prompt: "Show recent sign-in activity" },
  ],
};

/** Live, role-scoped starter actions for the Copilot welcome screen. Counts come from the caller's own data only. */
export async function GET() {
  return handle(async () => {
    const s = await requirePermission("ai.use");
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now)) % 24;
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const first = s.user.fullName.split(" ")[0];
    const actions: HeroAction[] = [];

    if (s.role === "STUDENT") {
      const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      const enr = st ? await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } }) : null;
      if (st && enr) {
        const week = new Date(now.getTime() + 7 * 86400000);
        const [due, lessons] = await Promise.all([
          prisma.assignment.count({ where: { institutionId: s.institutionId, divisionId: enr.divisionId, status: "PUBLISHED", dueAt: { gte: now, lte: week }, submissions: { none: { studentId: st.id } } } }),
          recentLessons(enr.divisionId, 1, 5),
        ]);
        const today = lessons.filter((l) => l.today);
        if (today.length) actions.push({ label: `Explain today's ${today[0].subject} lesson`, prompt: "Explain what we were taught today", hint: today[0].topic });
        if (due) actions.push({ label: `${due} homework due this week`, prompt: "What homework is due?", hint: "See and plan it" });
      }
      actions.push({ label: "How am I doing?", prompt: "How am I doing in quizzes?", hint: "Strengths and weak topics" });
      actions.push({ label: "Quiz me", prompt: "Quiz me on my weakest topic" });
    } else if (s.role === "TEACHER") {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (t) {
        const [toGrade, loggedToday] = await Promise.all([
          prisma.submission.count({ where: { assignment: { teacherId: t.id, institutionId: s.institutionId }, grade: null } }),
          prisma.lessonLog.count({ where: { teacherId: t.id, date: new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z") } }),
        ]);
        if (toGrade) actions.push({ label: `${toGrade} submission${toGrade === 1 ? "" : "s"} to grade`, prompt: "What needs grading?", hint: "Open the queue" });
        if (!loggedToday) actions.push({ label: "Log what you taught today", prompt: "I want to log today's lesson", hint: "Students' Nova will know it" });
      }
      actions.push({ label: "Plan a lesson", prompt: "Plan a 40-minute lesson" });
      actions.push({ label: "Look up a student", prompt: "Show details of a student in my class", hint: "Marks, quizzes, attendance" });
    } else {
      const cards = await prisma.smartIdCredential.count({ where: { institutionId: s.institutionId, status: "SUSPENDED" } });
      if (cards) actions.push({ label: `${cards} suspended Smart ID card${cards === 1 ? "" : "s"}`, prompt: "Show Smart ID card status" });
      actions.push({ label: "School overview", prompt: "Give me a school overview" });
      actions.push({ label: "Draft a circular", prompt: "Draft a circular about the new Smart ID cards" });
    }
    return NextResponse.json({ greeting: `${greeting}, ${first}`, actions: actions.slice(0, 5), agents: AGENTS[s.role] ?? AGENTS.ADMIN }, { headers: { "cache-control": "private, max-age=60" } });
  });
}
