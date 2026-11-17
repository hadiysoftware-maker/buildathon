"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, UserError } from "../shared";
import { nextReview } from "./leitner";

const PATHS = ["/student/flashcards", "/student"];
const Cards = z.object({
  topic: z.string().trim().min(1).max(120),
  cards: z.array(z.object({ front: z.string().trim().min(1).max(400), back: z.string().trim().min(1).max(600) })).min(1).max(12),
});

/** Saves cards to the signed-in student's own deck (skips ones already there). */
export async function saveFlashcards(input: z.input<typeof Cards>) {
  return action("quiz.take", async (s) => {
    const d = Cards.parse(input);
    const have = await prisma.flashcard.count({ where: { userId: s.userId } });
    if (have >= 400) throw new UserError("Your deck is full. Delete some cards first.");
    const existing = new Set((await prisma.flashcard.findMany({ where: { userId: s.userId, topic: d.topic }, select: { front: true } })).map((c) => c.front.toLowerCase()));
    const fresh = d.cards.filter((c) => !existing.has(c.front.toLowerCase()));
    if (fresh.length) await prisma.flashcard.createMany({ data: fresh.map((c) => ({ institutionId: s.institutionId, userId: s.userId, topic: d.topic, front: c.front, back: c.back })) });
    return { added: fresh.length };
  }, PATHS);
}

/** Records one review. Only the owner's card can change. */
export async function reviewCard(id: string, correct: boolean) {
  return action("quiz.take", async (s) => {
    const c = await prisma.flashcard.findFirst({ where: { id: z.string().max(30).parse(id), userId: s.userId }, select: { id: true, box: true } });
    if (!c) throw new UserError("Card not found.");
    await prisma.flashcard.update({ where: { id: c.id }, data: nextReview(c.box, correct) });
  }, PATHS);
}

export async function deleteCards(ids: string[]) {
  return action("quiz.take", async (s) => {
    const r = await prisma.flashcard.deleteMany({ where: { id: { in: z.array(z.string().max(30)).max(100).parse(ids) }, userId: s.userId } });
    return { deleted: r.count };
  }, PATHS);
}
