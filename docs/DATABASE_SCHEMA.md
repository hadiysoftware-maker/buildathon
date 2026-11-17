# Database schema

MySQL 8, InnoDB, `utf8mb4`, managed by Prisma (`prisma/schema.prisma`). The whole model for all nine phases is defined up front so later phases add features, not restructuring. Only the tables marked **active** are used by the first pass.

## Conventions

- Primary keys are `cuid` (`VARCHAR(30)`).
- Every top-level entity has `institutionId`; queries always filter on it.
- Soft deletion by `archivedAt` for academic records; people use `status` (`ACTIVE`, `INACTIVE`, `ARCHIVED`). History (enrollments, attendance, audit) is kept.
- Files are stored in R2; tables hold only the object key and metadata.
- Secrets are stored as HMACs/hashes (Smart ID secret, session token, enrollment code, admin password).

## Groups

| Group | Main models | Status |
|---|---|---|
| Identity & access | `Institution`, `InstitutionSetting`, `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `StudentProfile`, `TeacherProfile` | **active** |
| Smart ID & sessions | `SmartIdCredential`, `AuthSession`, `RegisteredDevice`, `DeviceChallenge`, `AuthenticationLog`, `RateLimitBucket` | **active** |
| Academic structure | `AcademicYear`, `Department`, `Course`, `Class`, `Division`, `Subject`, `CourseSubject`, `Classroom`, `Period`, `Enrollment`, `TeacherAssignment` | **active** |
| Timetable | `TimetableEntry`, `TimetableOverride` | **active** |
| Notifications & audit | `Notification`, `AuditLog` | **active** |
| Classroom & attendance | `ClassroomSession`, `Attendance`, … | schema only (phase 4) |
| Assignments, quizzes, library | assignment, submission, quiz, question, attempt, resource models | schema only (phase 5) |
| Digital twin | `StudentPortfolio` and related models | schema only (phase 6) |
| Copilot & AI | request/response logs, usage | schema only (phase 7) |
| Policies | policy and device-control records | schema only (phase 8) |

## Constraints that carry business rules

- `TimetableEntry @@unique([divisionId, dayOfWeek, periodId])`: a class cannot have two lessons in one slot. Teacher and classroom clashes are checked in code before writing (`src/lib/timetable/conflicts.ts`), with indexes on `(teacherId, dayOfWeek, periodId)` and `(classroomId, dayOfWeek, periodId)`.
- `Period @@unique([institutionId, sequence])`; periods are time-checked for overlap in code.
- `Enrollment @@unique([studentId, academicYearId, divisionId])`; transfers close the old row (`TRANSFERRED`) and create a new one.
- `SmartIdCredential.replacedById` is unique and links a replacement chain.
- `AuthSession.tokenHash` is unique and indexed for lookup.

## Commands

```bash
npx prisma validate        # no database needed
npx prisma generate        # emits src/generated/prisma
npx prisma migrate dev     # needs DATABASE_URL
npm run db:seed            # institution, roles, permissions, settings, default periods
SEED_DEMO=true npm run db:seed   # plus a small, labelled demo structure
```
