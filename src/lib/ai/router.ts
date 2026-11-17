import "server-only";
import { toolsFor } from "@/lib/ai/tools";

/**
 * Zero-token routing. Plain data questions ("school stats", "my timetable", "find Zoya") are answered by running the
 * role-scoped tools directly and drawing their visuals, with no model call. Anything open-ended returns null and
 * goes to the model. A message is handled here only when EVERY part of it is recognised.
 */
export interface Step { tool: string; args: Record<string, unknown>; lead: string }
export type Routed = { kind: "tools"; steps: Step[] } | { kind: "text"; text: string };

const LEADS: Record<string, string> = {
  get_today_schedule: "Here is today's timetable.",
  get_my_subjects: "Here are your subjects.",
  get_my_notifications: "Here are your latest notifications.",
  list_my_students: "Here are your students.",
  school_stats: "Here is the school at a glance.",
  students_by_division: "Students per division.",
  find_people: "Here is what I found.",
  list_materials: "Here is the study material.",
  my_week_load: "Your teaching load this week.",
  teacher_workload: "Teacher workload this week.",
  sign_in_activity: "Recent sign-in activity.",
  open_page: "Here you go.",
  card_status: "Smart ID card status.",
  my_attendance: "Your attendance.",
  my_assignments: "Here is your homework.",
  my_quiz_performance: "Here is how your quizzes are going.",
  my_portfolio: "Here is your portfolio.",
  my_lessons: "Here is what was taught.",
  at_risk_students: "Here are the students who need attention.",
  assignments_to_grade: "Here is what needs grading.",
  quiz_analytics: "Here are your quiz results.",
  mark_notifications_read: "Done.",
};

const OPEN_ENDED = /\b(report|pdf|export|download|document|present|absent|late|which days?|why|how (do|can|should|to)|explain|write|draft|plan|make|create|quiz|summari[sz]e|help|suggest|compare|recommend|outline|rubric|essay|lesson)\b/;
const STOP_NAME = /^(me|my|all|the|school|students?|teachers?|people|everyone|stats|today|it|this|that)$/;

function routePart(part: string, role: string): Step | { text: string } | null {
  const t = part.trim().toLowerCase().replace(/[?!.]+$/g, "");
  if (!t) return null;
  const has = (name: string) => toolsFor(role).some((x) => x.name === name);
  const NA = { text: "That is not available for your role. I can still help with the things your account can see." };
  const step = (tool: string, args: Record<string, unknown> = {}): Step | { text: string } => (has(tool) ? { tool, args, lead: LEADS[tool] } : NA);

  if (/^(hi|hello|hey|yo|hola|namaste|good (morning|afternoon|evening))( nova| there)?$/.test(t)) return { text: "Hi! I can pull up your data in one tap, or help with planning and writing. Try one of the suggestions below." };
  if (/^(thanks|thank you|thx|ok|okay|cool|great|got it|nice)( nova)?$/.test(t)) return { text: "You are welcome. Ask me anything else when you are ready." };
  if (/^(what can you do|help|what do you do)$/.test(t)) {
    const names = toolsFor(role).filter((x) => x.name !== "show_summary").length;
    return { text: `I can look up live school data (${names} tools for your role) and show it as charts, cards and timelines, or help you plan and write. Data questions cost no AI credits.` };
  }
  if (OPEN_ENDED.test(t)) return null;

  if (/^(please )?(mark|clear|dismiss)\b.*\b(notifications?|alerts?)\b|^mark (all )?(as )?read$/.test(t)) return step("mark_notifications_read");
  const nav = /^(?:please )?(?:open|go to|take me to|navigate to|show me the|link to)\s+(?:the |my )?(.{2,40})$/.exec(t);
  if (nav && /\b(page|library|timetable|schedule|smart id|cards?|students?|teachers?|devices?|audit|logins?|copilot|dashboard|home|overview|today)\b/.test(nav[1]) && !/\bmy (week|day)\b/.test(t)) return step("open_page", { query: nav[1] });
  if (/\b(card status|smart id status|cards? by status|missing cards?|without (a )?cards?)\b/.test(t)) return step("card_status");
  if (/\b(quiz(zes)? (performance|results?|scores?|progress|history)|how am i doing|what about my (perf\w*|progress)|my perf\w+|my (weak|strong) (topics?|areas?|subjects?)|my progress)\b/.test(t)) return has("my_quiz_performance") ? step("my_quiz_performance") : step("quiz_analytics");
  if (/\b(my )?(assignments?|homework|home work)\b|\bwhat('?s| is) due\b/.test(t)) return step("my_assignments");
  if (/\b(what needs grading|to grade|pending (grading|submissions)|ungraded)\b/.test(t)) return step("assignments_to_grade");
  if (/\b(at[- ]?risk|struggling|falling behind)\b/.test(t) && /\bstudents?\b/.test(t) && has("at_risk_students")) return step("at_risk_students");
  if (/\bmy portfolio\b/.test(t)) return step("my_portfolio");
  if (/\b(what (was|did we|have we|is being) (taught|learn(ed|t)?|covered)|today'?s (lesson|class|topic)|my subjects|who teaches)\b/.test(t) && has("my_lessons")) return step("my_lessons");
  if (/\b(my )?attendance\b/.test(t)) return step("my_attendance");
  if (/\b(sign[- ]?ins?|log ?ins?|login activity|auth(entication)? (log|activity))\b/.test(t)) return step("sign_in_activity");
  if (/\b(per|by|each) (division|class|section)\b|^students (per|by)\b|\bdivision wise\b/.test(t)) return step("students_by_division");
  if (/\b(my )?(weekly|week) (load|workload)\b|^my workload$|\bperiods (this|per) week\b/.test(t)) return has("my_week_load") ? step("my_week_load") : step("teacher_workload");
  if (/\bteacher workload\b|^workload$/.test(t)) return has("teacher_workload") ? step("teacher_workload") : step("my_week_load");
  if (/\b(school )?(stats|statistics|overview|headcount|snapshot)\b|\bhow many (students|teachers|users|people|cards|classes)\b/.test(t)) return step("school_stats");
  if (/\b(schedule|timetable|time table|periods today|classes today|my day|what'?s next)\b/.test(t)) return step("get_today_schedule");
  if (/\b(my subjects?|which subjects?|subjects i)\b|^subjects$/.test(t)) return step("get_my_subjects");
  if (/\b(notifications?|alerts?|unread|inbox)\b/.test(t)) return step("get_my_notifications");
  if (/\b(my students|students list|list (of )?(my )?students|class list|my class)\b/.test(t)) return step("list_my_students");
  if (/\b(materials?|study materials?|resources|library|worksheets?)\b/.test(t)) return step("list_materials");

  const m = /^(?:please )?(?:find|search(?: for)?|look ?up|show|who is|get|details? (?:of|for|about))\s+(?:me )?(?:the )?(student|teacher)?\s*(?:named|called)?\s*([a-z][a-z .'-]{1,40})$/.exec(t);
  if (m) {
    const name = m[2].trim();
    if (!STOP_NAME.test(name) && name.split(/\s+/).length <= 3) return step("find_people", { kind: m[1] ?? (/\bteacher\b/.test(t) ? "teacher" : "student"), name });
  }
  return null;
}

export function routeIntent(message: string, role: string): Routed | null {
  if (message.length > 160) return null;
  const parts = message.split(/\s*(?:,|;|&|\band\b|\bthen\b|\balso\b)\s*/i).filter((p) => p.trim());
  if (parts.length === 0 || parts.length > 4) return null;
  const steps: Step[] = [];
  let text: string | null = null;
  for (const p of parts) {
    const r = routePart(p, role);
    if (!r) return null;
    if ("text" in r) { if (parts.length > 1) return null; text = r.text; } else if (!steps.some((s) => s.tool === r.tool && JSON.stringify(s.args) === JSON.stringify(r.args))) steps.push(r);
  }
  if (text) return { kind: "text", text };
  return steps.length ? { kind: "tools", steps } : null;
}

/**
 * Multi-topic requests ("a report on my attendance, timetable and notifications") are fanned out: one agent per topic
 * runs at the same time, and the model only has to combine what they bring back. Returns null unless 2+ topics match.
 */
const TOPICS: { re: RegExp; tools: string[] }[] = [
  { re: /\battendance\b/, tools: ["my_attendance"] },
  { re: /\b(timetable|time table|schedule|today'?s (classes|periods))\b/, tools: ["get_today_schedule"] },
  { re: /\b(notifications?|alerts?|inbox)\b/, tools: ["get_my_notifications"] },
  { re: /\bsubjects?\b/, tools: ["get_my_subjects"] },
  { re: /\b(materials?|library|worksheets?)\b/, tools: ["list_materials"] },
  { re: /\b(stats|statistics|headcount|how many|overview)\b/, tools: ["school_stats"] },
  { re: /\b(smart id|cards?)\b/, tools: ["card_status"] },
  { re: /\b(workload|teaching load|week load)\b/, tools: ["my_week_load", "teacher_workload"] },
  { re: /\b(sign[- ]?ins?|logins?)\b/, tools: ["sign_in_activity"] },
  { re: /\b(assignments?|homework)\b/, tools: ["my_assignments", "assignments_to_grade"] },
  { re: /\b(quiz(zes)? (performance|results?|scores?)|progress|weak topics?)\b/, tools: ["my_quiz_performance", "quiz_analytics"] },
  { re: /\bportfolio\b/, tools: ["my_portfolio"] },
  { re: /\b(taught|lesson|subjects?)\b/, tools: ["my_lessons"] },
];
export function fanOut(message: string, role: string): string[] | null {
  const t = message.toLowerCase();
  const available = new Set(toolsFor(role).map((x) => x.name));
  const picked: string[] = [];
  for (const topic of TOPICS) {
    if (!topic.re.test(t)) continue;
    const name = topic.tools.find((n) => available.has(n));
    if (name && !picked.includes(name)) picked.push(name);
  }
  return picked.length >= 2 ? picked.slice(0, 4) : null;
}
