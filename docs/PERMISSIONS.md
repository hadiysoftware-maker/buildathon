# Permissions (RBAC)

Permissions are strings defined in code (`src/lib/permissions/index.ts`) and mirrored into the `Permission` / `RolePermission` tables by the seed. The code is the source of truth; the tables let the data be queried and audited.

| Permission | Meaning |
|---|---|
| `institution.manage` | Institution settings, administrators, the device-enrollment policy |
| `academic.manage` | Years, departments, courses, classes, subjects, periods, classrooms |
| `timetable.manage` | Build and edit timetables |
| `students.manage` | Create, edit, enroll, transfer and archive students |
| `teachers.manage` | Create, edit and archive teachers |
| `smartid.manage` | Issue, replace, suspend and revoke cards; end sessions |
| `devices.manage` | Register devices and issue enrollment codes |
| `audit.view` | See sign-in and audit logs |
| `timetable.view.own` | See your own timetable |
| `classroom.teach` | Run live classes (later phase) |
| `portfolio.view.own` | See your own portfolio (later phase) |

## Roles

| Role | Gets |
|---|---|
| `SUPER_ADMIN` | Everything |
| `ADMIN` | All management permissions except `institution.manage` |
| `TEACHER` | `timetable.view.own`, `classroom.teach` |
| `STUDENT` | `timetable.view.own`, `portfolio.view.own` |
| `GUARDIAN` | Reserved; none yet |

## Enforcement

- **Server Actions** go through `action(permission, …)`, which calls `requirePermission`.
- **Pages** call `requirePagePermission(perm)` or `requireRolePage(roles, loginPath)` at the top. Layouts also wrap pages in the workspace shell, but a layout is not a security boundary because Next.js can render a page without re-running its layout.
- **Route Handlers** call `requireSession` / `requirePermission`.
- **The sidebar** hides items the role cannot use, purely for usability. Hidden is not protected; the server check is.
- Admin and non-admin portals are separate: a student's session cannot open `/admin/*` and vice versa, and each portal redirects to its own login.
- Object-level checks: every lookup by id also filters on the session's `institutionId`.
