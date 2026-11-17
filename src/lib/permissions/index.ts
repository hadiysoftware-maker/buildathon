export type RoleKey = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | "GUARDIAN";

export const PERMISSIONS = {
  "institution.manage": "Manage institution settings and administrators",
  "academic.manage": "Manage years, departments, courses, classes, subjects, periods, classrooms",
  "timetable.manage": "Build and edit timetables",
  "students.manage": "Create, edit, enroll and archive students",
  "teachers.manage": "Create, edit and archive teachers",
  "smartid.manage": "Generate, revoke and replace Smart ID cards",
  "devices.manage": "Register and manage institution devices",
  "audit.view": "View audit and authentication logs",
  "timetable.view.own": "View own timetable",
  "classroom.teach": "Start and run live classes",
  "portfolio.view.own": "View own digital portfolio",
  "library.manage": "Upload and publish study material",
  "assignments.manage": "Create, publish and grade assignments",
  "assignments.submit": "View and submit assignments",
  "quiz.manage": "Build question banks and quizzes",
  "quiz.take": "Take quizzes",
  "portfolio.view.any": "View student portfolios",
  "ai.use": "Use the AI copilot",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const ADMIN_PERMS: PermissionKey[] = [
  "academic.manage",
  "timetable.manage",
  "students.manage",
  "teachers.manage",
  "smartid.manage",
  "devices.manage",
  "audit.view",
  "library.manage",
  "portfolio.view.any",
  "ai.use",
];

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: Object.keys(PERMISSIONS) as PermissionKey[],
  ADMIN: ADMIN_PERMS,
  TEACHER: ["timetable.view.own", "classroom.teach", "library.manage", "assignments.manage", "quiz.manage", "portfolio.view.any", "ai.use"],
  STUDENT: ["timetable.view.own", "portfolio.view.own", "assignments.submit", "quiz.take", "ai.use"],
  GUARDIAN: [],
};

export function hasPermission(role: RoleKey, perm: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

export const ADMIN_ROLES: RoleKey[] = ["SUPER_ADMIN", "ADMIN"];
export const isAdminRole = (r: RoleKey) => ADMIN_ROLES.includes(r);
