import type { IconName } from "@/components/ui/Icon";

/** `module` holds a permission key (see lib/permissions); items without it are visible to the whole role. */
export interface NavSubItem {
  title: string;
  href: string;
  module?: string;
}
export interface NavItem {
  title: string;
  href: string;
  icon: IconName;
  module?: string;
  children?: NavSubItem[];
}
export interface NavGroup {
  label: string;
  icon: IconName;
  items: NavItem[];
}

const ADMIN_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    icon: "dashboard",
    items: [
      { title: "Overview", href: "/admin", icon: "dashboard" },
      {
        title: "Academic Management",
        href: "/admin/academic",
        icon: "institution",
        module: "academic.manage",
        children: [
          { title: "Academic Years", href: "/admin/academic/years" },
          { title: "Departments", href: "/admin/academic/departments" },
          { title: "Courses", href: "/admin/academic/courses" },
          { title: "Classes", href: "/admin/academic/classes" },
          { title: "Subjects", href: "/admin/academic/subjects" },
          { title: "Periods", href: "/admin/academic/periods" },
          { title: "Timetable", href: "/admin/academic/timetable", module: "timetable.manage" },
          { title: "Classrooms", href: "/admin/academic/classrooms" },
        ],
      },
      {
        title: "People",
        href: "/admin/people",
        icon: "users",
        children: [
          { title: "Students", href: "/admin/people/students", module: "students.manage" },
          { title: "Teachers", href: "/admin/people/teachers", module: "teachers.manage" },
        ],
      },
      { title: "Smart ID Cards", href: "/admin/smart-id", icon: "qr", module: "smartid.manage" },
      { title: "Devices", href: "/admin/devices", icon: "monitor", module: "devices.manage" },
      { title: "Audit & Logins", href: "/admin/audit", icon: "shieldCheck", module: "audit.view" },
      { title: "AI Copilot", href: "/admin/copilot", icon: "sparkles", module: "ai.use" },
    ],
  },
];

const TEACHER_GROUPS: NavGroup[] = [
  {
    label: "Teaching",
    icon: "teacher",
    items: [
      { title: "Overview", href: "/teacher", icon: "dashboard" },
      { title: "My Timetable", href: "/teacher/timetable", icon: "calendar" },
      { title: "Library", href: "/teacher/library", icon: "read", module: "library.manage" },
      { title: "AI Copilot", href: "/teacher/copilot", icon: "sparkles", module: "ai.use" },
    ],
  },
];

const STUDENT_GROUPS: NavGroup[] = [
  {
    label: "Learning",
    icon: "graduation",
    items: [
      { title: "Learning Home", href: "/student", icon: "home" },
      { title: "Today's Timetable", href: "/student/timetable", icon: "calendar" },
      { title: "Library", href: "/student/library", icon: "read" },
      { title: "AI Copilot", href: "/student/copilot", icon: "sparkles", module: "ai.use" },
    ],
  },
];

export function getSidebarGroups(role: string): NavGroup[] {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return ADMIN_GROUPS;
    case "TEACHER":
      return TEACHER_GROUPS;
    case "STUDENT":
      return STUDENT_GROUPS;
    default:
      return [];
  }
}

/** Drops items/children the caller lacks permission for, and groups left empty. */
export function filterSidebarGroups(groups: NavGroup[], isAllowed: (mod?: string) => boolean): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => isAllowed(i.module))
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => isAllowed(c.module)) } : i)),
    }))
    .filter((g) => g.items.length > 0);
}

export function getFlatNavPages(groups: NavGroup[]) {
  const out: { title: string; href: string; icon: IconName; section: string }[] = [];
  for (const g of groups) {
    for (const i of g.items) {
      out.push({ title: i.title, href: i.href, icon: i.icon, section: g.label });
      for (const c of i.children ?? []) out.push({ title: c.title, href: c.href, icon: i.icon, section: i.title });
    }
  }
  return out;
}

export function getBottomDockItems(role: string, isAllowed: (mod: string) => boolean) {
  const flat = getFlatNavPages(filterSidebarGroups(getSidebarGroups(role), (m) => !m || isAllowed(m)));
  const top = flat.filter((p) => p.href.split("/").length <= 3);
  return top.slice(0, 4).map((p) => ({ href: p.href, label: p.title, icon: p.icon }));
}

export function getPageTitle(pathname: string): string {
  const flat = getFlatNavPages([...ADMIN_GROUPS, ...TEACHER_GROUPS, ...STUDENT_GROUPS]);
  const hit = flat.filter((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.title ?? "Campus 2035";
}
