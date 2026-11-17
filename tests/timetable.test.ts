import { describe, expect, it } from "vitest";
import { detectConflicts, type SlotEntry } from "@/lib/timetable/conflicts";
import { classifyPeriod, nowInZone, periodsOverlap, toMinutes, validPeriodTimes } from "@/lib/timetable/schedule";

const base: SlotEntry = { id: "e1", divisionId: "d1", dayOfWeek: 1, periodId: "p1", subjectId: "s1", teacherId: "t1", classroomId: "r1" };

describe("timetable conflicts", () => {
  it("accepts a free slot", () => {
    expect(detectConflicts({ ...base, id: undefined }, [])).toEqual([]);
  });
  it("detects teacher double booking across divisions", () => {
    const c = detectConflicts({ ...base, id: undefined, divisionId: "d2", classroomId: "r2" }, [base]);
    expect(c.map((x) => x.kind)).toEqual(["TEACHER_DOUBLE_BOOKED"]);
  });
  it("detects classroom double booking", () => {
    const c = detectConflicts({ ...base, id: undefined, divisionId: "d2", teacherId: "t2" }, [base]);
    expect(c.map((x) => x.kind)).toEqual(["CLASSROOM_DOUBLE_BOOKED"]);
  });
  it("detects an occupied division slot", () => {
    const c = detectConflicts({ ...base, id: undefined, teacherId: "t2", classroomId: "r2" }, [base]);
    expect(c.map((x) => x.kind)).toEqual(["DIVISION_SLOT_TAKEN"]);
  });
  it("ignores other days/periods", () => {
    expect(detectConflicts({ ...base, id: undefined, dayOfWeek: 2 }, [base])).toEqual([]);
    expect(detectConflicts({ ...base, id: undefined, periodId: "p2" }, [base])).toEqual([]);
  });
  it("does not conflict with itself when editing", () => {
    expect(detectConflicts(base, [base])).toEqual([]);
  });
  it("enforces weekly subject workload", () => {
    const existing = [1, 2, 3].map((d) => ({ ...base, id: `x${d}`, dayOfWeek: d + 1 }));
    const c = detectConflicts({ ...base, id: undefined, dayOfWeek: 5 }, existing, { periodsPerWeek: 3 });
    expect(c.map((x) => x.kind)).toEqual(["SUBJECT_WORKLOAD"]);
    expect(detectConflicts({ ...base, id: undefined, dayOfWeek: 5 }, existing, { periodsPerWeek: 4 })).toEqual([]);
  });
});

describe("period schedule", () => {
  const p = { startTime: "09:00", endTime: "09:45", kind: "CLASS" as const };
  it("parses times and validates ranges", () => {
    expect(toMinutes("09:45")).toBe(585);
    expect(validPeriodTimes("09:00", "09:45")).toBe(true);
    expect(validPeriodTimes("09:45", "09:00")).toBe(false);
    expect(validPeriodTimes("25:00", "26:00")).toBe(false);
  });
  it("detects overlaps but allows back-to-back periods", () => {
    expect(periodsOverlap(p, { startTime: "09:30", endTime: "10:15" })).toBe(true);
    expect(periodsOverlap(p, { startTime: "09:45", endTime: "10:30" })).toBe(false);
  });
  it("classifies periods", () => {
    expect(classifyPeriod(p, toMinutes("08:00"))).toBe("upcoming");
    expect(classifyPeriod(p, toMinutes("09:10"))).toBe("current");
    expect(classifyPeriod(p, toMinutes("09:45"))).toBe("completed");
    expect(classifyPeriod({ ...p, kind: "BREAK" }, toMinutes("09:10"))).toBe("break");
    expect(classifyPeriod(p, toMinutes("09:10"), true)).toBe("cancelled");
  });
  it("computes zoned day/time", () => {
    // 2026-11-16 is a Monday; 04:30 UTC = 10:00 in Asia/Kolkata.
    expect(nowInZone("Asia/Kolkata", new Date("2026-11-16T04:30:00Z"))).toEqual({ dayOfWeek: 1, minutes: 600 });
  });
});
