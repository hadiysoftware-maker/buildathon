import type { IconName } from "@/components/ui/Icon";

/**
 * Command palette entries that are NOT plain pages (pages come from nav-config). Each role has its own list, and each
 * entry can require a permission; the palette hides anything the signed-in user's role lacks. This only shapes the UI:
 * the pages and actions behind these entries re-check permissions on the server.
 */
export type CommandAction = "copilot" | "account" | "logout";

export interface Command {
  id: string;
  title: string;
  section: string;
  icon: IconName;
  href?: string;
  action?: CommandAction;
  perm?: string;
  keywords?: string;
}

const ADMIN: Command[] = [
  { id: "a-student", title: "Add or import students", section: "Actions", icon: "users", href: "/admin/people/students", perm: "students.manage", keywords: "new enrol enroll csv" },
  { id: "a-teacher", title: "Add a teacher", section: "Actions", icon: "teacher", href: "/admin/people/teachers", perm: "teachers.manage", keywords: "new staff" },
  { id: "a-cards", title: "Issue Smart ID cards", section: "Actions", icon: "qr", href: "/admin/smart-id", perm: "smartid.manage", keywords: "print revoke replace suspend" },
  { id: "a-timetable", title: "Edit the timetable", section: "Actions", icon: "calendar", href: "/admin/academic/timetable", perm: "timetable.manage", keywords: "schedule periods" },
  { id: "a-device", title: "Enroll a kiosk device", section: "Actions", icon: "monitor", href: "/admin/devices", perm: "devices.manage", keywords: "laptop code" },
  { id: "a-logs", title: "Review sign-in activity", section: "Actions", icon: "shieldCheck", href: "/admin/audit", perm: "audit.view", keywords: "security log failed" },
];

const TEACHER: Command[] = [
  { id: "t-today", title: "Today's classes", section: "Actions", icon: "calendar", href: "/teacher", keywords: "schedule next period" },
  { id: "t-week", title: "Weekly timetable", section: "Actions", icon: "calendar", href: "/teacher/timetable", keywords: "week" },
  { id: "t-upload", title: "Upload study material", section: "Actions", icon: "read", href: "/teacher/library", perm: "library.manage", keywords: "pdf publish notes" },
];

const STUDENT: Command[] = [
  { id: "s-today", title: "What is my next class?", section: "Actions", icon: "calendar", href: "/student", keywords: "schedule today" },
  { id: "s-material", title: "Open study material", section: "Actions", icon: "read", href: "/student/library", keywords: "notes pdf" },
];

const COMMON: Command[] = [
  { id: "c-ai", title: "Ask the AI Copilot", section: "Assistant", icon: "sparkles", action: "copilot", perm: "ai.use", keywords: "chat nova help" },
  { id: "c-account", title: "Account and profile photo", section: "Account", icon: "user", action: "account", keywords: "settings avatar text size" },
  { id: "c-logout", title: "Sign out", section: "Account", icon: "signout", action: "logout" },
];

export function commandsFor(role: string): Command[] {
  const own = role === "ADMIN" || role === "SUPER_ADMIN" ? ADMIN : role === "TEACHER" ? TEACHER : role === "STUDENT" ? STUDENT : [];
  return [...own, ...COMMON];
}
