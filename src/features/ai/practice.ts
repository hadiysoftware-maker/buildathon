"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { upsertLearningNote } from "@/lib/ai/memory";
import { practiceSummary } from "@/lib/ai/practice-data";
import { action } from "../shared";

const In = z.object({
  topic: z.string().trim().min(1).max(200),
  questions: z.array(z.object({ q: z.string().max(500), picked: z.string().max(300), correct: z.string().max(300), isCorrect: z.boolean(), why: z.string().max(500).optional() })).min(1).max(30),
});

/** Saves a finished Copilot quiz for the signed-in user only, and keeps a short learning note for the Copilot. */
export async function recordPracticeAttempt(input: z.input<typeof In>) {
  return action("ai.use", async (s) => {
    const d = In.parse(input);
    const score = d.questions.filter((q) => q.isCorrect).length;
    const st = s.role === "STUDENT" ? await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } }) : null;
    await prisma.practiceAttempt.create({
      data: { institutionId: s.institutionId, userId: s.userId, studentId: st?.id ?? null, topic: d.topic, score, total: d.questions.length, source: "COPILOT", answers: d.questions },
    });
    const sum = await practiceSummary(s.userId, s.institutionId);
    const t = sum.topics.find((x) => x.topic === d.topic.toLowerCase());
    if (t) await upsertLearningNote(s.userId, d.topic, `${t.pct >= 80 ? "Strong" : t.pct >= 60 ? "Okay" : "Weak"} at ${d.topic} (${t.pct}% over ${t.attempts} quiz${t.attempts === 1 ? "" : "zes"}, last ${score}/${d.questions.length}).`);
    return { score };
  }, []);
}
