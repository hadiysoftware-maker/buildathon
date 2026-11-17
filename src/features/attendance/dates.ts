/** Pure date helpers for attendance (no server imports, so they are unit-testable). */
export const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const ymdToDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
/** 1 = Monday … 7 = Sunday, the same convention as the timetable. */
export const dowOf = (ymd: string) => { const d = ymdToDate(ymd).getUTCDay(); return d === 0 ? 7 : d; };
export const todayYmd = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export const shiftYmd = (ymd: string, days: number) => new Date(ymdToDate(ymd).getTime() + days * 86_400_000).toISOString().slice(0, 10);
export const MAX_BACKDATE_DAYS = 14;
