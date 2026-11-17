/** Leitner spaced repetition: a right answer moves the card up a box (longer wait), a wrong one sends it back to box 1. */
export const BOX_DAYS = [0, 1, 2, 4, 8, 16] as const; // index = box number

export function nextReview(box: number, correct: boolean, now = new Date()): { box: number; dueAt: Date } {
  const b = correct ? Math.min(5, Math.max(1, box) + 1) : 1;
  return { box: b, dueAt: new Date(now.getTime() + BOX_DAYS[b] * 86400000) };
}
