/** Dates are stored as UTC midnight (`@db.Date`); format them in UTC so the day never shifts. */
export const fmtDate = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

export const fmtDateTime = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const toDateInput = (d: Date | string): string => new Date(d).toISOString().slice(0, 10);

export function greetingNow(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
