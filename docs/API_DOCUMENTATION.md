# API documentation

State-changing endpoints are same-origin only (a foreign `Origin` is rejected). Bodies and responses are JSON.

## Authentication

### `POST /api/auth/smart-id`
Body:
```json
{ "payload": "C35:<credentialId>.<secret>", "portal": "kiosk | teacher",
  "device": { "id": "…", "nonce": "…", "signature": "…" } }
```
`device` is needed only when the institution requires an enrolled device.

- Success: `200 { "ok": true, "redirect": "/student", "role": "STUDENT" }` and the session cookie is set.
- Failure: `{ "ok": false, "code": "<AuthResult>" }` with a status of 401 (`INVALID_CREDENTIAL`), 403 (`REVOKED`, `SUSPENDED`, `REPLACED`, `ACCOUNT_INACTIVE`, `DEVICE_UNAUTHORIZED`, `WRONG_PORTAL`) or 429 (`RATE_LIMITED`).

The `code` lets the scanner show a specific message. Every attempt is also written to `AuthenticationLog`.

### `POST /api/auth/admin`
Body: `{ "email": string, "password": string }`. Failure is `{ "ok": false, "error": string }`: 401 for bad credentials (the same message whether or not the email exists), 423 when locked, 429 when rate limited.

### `POST /api/auth/logout`
Revokes the current session and clears the cookie.

## Devices

### `POST /api/devices/challenge`
Body: `{ "deviceId": string }` → `{ "nonce": string }` (valid 2 minutes, single use). 403 if the device is not active.

### `POST /api/devices/enroll`
Body: `{ "code": string, "publicKeyJwk": { "kty": "EC", "crv": "P-256", "x": string, "y": string } }` → `{ "deviceId": string }`. 400 for an invalid or expired code, 429 when rate limited. The code works once.

## Notifications

| Endpoint | Purpose |
|---|---|
| `GET /api/notifications` | The signed-in user's latest notifications and unread count |
| `PATCH /api/notifications` | Mark all of the caller's notifications read |
| `PATCH /api/notifications/[id]` | Mark one of the caller's notifications read |

## Server Actions

Admin writes are Server Actions, not public endpoints. They return `{ ok: true, data? } | { ok: false, error }`.

| Module | Actions |
|---|---|
| `features/academic/actions` | create / update / archive for departments, courses, divisions, classrooms, subjects, periods; create / archive for years (plus `activateAcademicYear`) and classes; `assignTeacher`, `removeTeacherAssignment` |
| `features/people/actions` | `createStudent`, `updateStudent`, `transferStudent`, `setStudentStatus`, `importStudentsCsv`, and the teacher equivalents |
| `features/timetable/actions` | `setTimetableEntry` (returns `conflicts` and does not save when a clash exists), `removeTimetableEntry`, `overrideTimetableEntry` (cancel or substitute one day), `copyTimetable` |
| `features/smart-id/actions` | `issueCard`, `bulkIssueCards`, `replaceCard`, `revokeCard`, `suspendCard`, `reactivateCard`, `revokeSessionsFor`, `createDevice`, `issueEnrollmentCode`, `setDeviceStatus`, `setRequireEnrolledDevice` |

## CSV formats

Header row required, case-insensitive, at most 500 rows.

- Students: `fullName, email, phone, dateOfBirth (YYYY-MM-DD), guardianName, guardianPhone, admissionNumber, departmentCode, courseCode`
- Teachers: `fullName, email, phone, employeeId, qualification, designation, specialization, departmentCode`

Imported people get no Smart ID card automatically; issue them in bulk from the Smart ID page.

## Planned (not implemented)

Realtime (Socket.IO) events, WebRTC signalling, the Groq AI gateway and R2 presigned uploads. See SYSTEM_ARCHITECTURE.md.
