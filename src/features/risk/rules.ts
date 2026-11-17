export interface RiskInput { attendancePct: number | null; attendanceDays: number; quizRecent: number | null; quizEarlier: number | null; overdue: number }
export interface Risk { reasons: string[]; level: "high" | "watch" | null }

/** Pure rules, no AI: low attendance, falling quiz scores, several overdue assignments. */
export function evaluateRisk(i: RiskInput): Risk {
  const reasons: string[] = [];
  if (i.attendancePct !== null && i.attendanceDays >= 5 && i.attendancePct < 75) reasons.push(`Attendance ${Math.round(i.attendancePct)}% in the last 30 days`);
  if (i.quizRecent !== null && i.quizEarlier !== null && i.quizEarlier - i.quizRecent >= 15) reasons.push(`Quiz average down from ${Math.round(i.quizEarlier)}% to ${Math.round(i.quizRecent)}%`);
  if (i.overdue >= 2) reasons.push(`${i.overdue} assignments overdue`);
  return { reasons, level: reasons.length >= 2 ? "high" : reasons.length === 1 ? "watch" : null };
}
