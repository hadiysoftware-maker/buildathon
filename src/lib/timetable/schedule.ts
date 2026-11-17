export type PeriodStatus = "completed" | "current" | "upcoming" | "break" | "cancelled";

/** "HH:MM" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function validPeriodTimes(start: string, end: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(end) && toMinutes(end) > toMinutes(start);
}

export function periodsOverlap(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }): boolean {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

export function classifyPeriod(
  p: { startTime: string; endTime: string; kind: "CLASS" | "BREAK" | "LUNCH" },
  nowMinutes: number,
  cancelled = false,
): PeriodStatus {
  if (cancelled) return "cancelled";
  if (p.kind !== "CLASS") return "break";
  if (nowMinutes >= toMinutes(p.endTime)) return "completed";
  if (nowMinutes >= toMinutes(p.startTime)) return "current";
  return "upcoming";
}

/** Current wall-clock {dayOfWeek (1=Mon..7=Sun), minutes} in an IANA timezone. */
export function nowInZone(timeZone: string, date = new Date()): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { dayOfWeek: dayMap[get("weekday")] ?? 1, minutes: Number(get("hour")) % 24 * 60 + Number(get("minute")) };
}
