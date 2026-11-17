import { describe, expect, it } from "vitest";
import { nextReview, BOX_DAYS } from "@/features/flashcards/leitner";
import { evaluateRisk } from "@/features/risk/rules";
import { signAct, readAct } from "@/lib/ai/act-token";

describe("flashcard scheduling (Leitner)", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  it("moves a right answer up one box and waits longer", () => {
    const r = nextReview(2, true, now);
    expect(r.box).toBe(3);
    expect(r.dueAt.getTime() - now.getTime()).toBe(BOX_DAYS[3] * 86400000);
  });
  it("sends a wrong answer back to box 1, due tomorrow", () => {
    const r = nextReview(4, false, now);
    expect(r.box).toBe(1);
    expect(r.dueAt.getTime() - now.getTime()).toBe(86400000);
  });
  it("never goes past box 5", () => expect(nextReview(5, true, now).box).toBe(5));
});

describe("at-risk rules", () => {
  const base = { attendancePct: 95, attendanceDays: 20, quizRecent: 80, quizEarlier: 82, overdue: 0 };
  it("flags nobody who is doing fine", () => expect(evaluateRisk(base).level).toBeNull());
  it("ignores attendance when there are too few days recorded", () => expect(evaluateRisk({ ...base, attendancePct: 40, attendanceDays: 3 }).level).toBeNull());
  it("watches low attendance", () => expect(evaluateRisk({ ...base, attendancePct: 60 }).level).toBe("watch"));
  it("watches a quiz drop of 15 points or more", () => expect(evaluateRisk({ ...base, quizRecent: 55, quizEarlier: 75 }).level).toBe("watch"));
  it("marks two problems as high", () => {
    const r = evaluateRisk({ ...base, attendancePct: 60, overdue: 3 });
    expect(r.level).toBe("high");
    expect(r.reasons).toHaveLength(2);
  });
});

describe("Copilot confirmations are private", () => {
  it("a log_lesson proposal only works for the user it was made for", () => {
    process.env.SESSION_PEPPER = "test-pepper-0123456789abcdef";
    const t = signAct("teacher-a", "log_lesson", { topic: "Fractions" });
    expect(readAct("teacher-a", t)?.k).toBe("log_lesson");
    expect(readAct("teacher-b", t)).toBeNull();
  });
});
