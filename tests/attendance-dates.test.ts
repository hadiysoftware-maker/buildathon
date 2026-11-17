import { describe, expect, it } from "vitest";
import { dowOf, isYmd, shiftYmd, todayYmd } from "@/features/attendance/dates";

describe("attendance dates", () => {
  it("validates real calendar dates only", () => {
    expect(isYmd("2026-11-17")).toBe(true);
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("17-11-2026")).toBe(false);
    expect(isYmd("2026-11-17; DROP")).toBe(false);
  });
  it("uses Monday=1 to Sunday=7 like the timetable", () => {
    expect(dowOf("2026-11-16")).toBe(1);
    expect(dowOf("2026-11-17")).toBe(2);
    expect(dowOf("2026-11-22")).toBe(7);
  });
  it("shifts across month ends", () => {
    expect(shiftYmd("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftYmd("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("reads today in the institution timezone", () => {
    const t = new Date("2026-11-17T12:00:00Z");
    expect(todayYmd("Asia/Kolkata", t)).toBe("2026-11-17");
    expect(todayYmd("UTC", t)).toBe("2026-11-17");
  });
});
