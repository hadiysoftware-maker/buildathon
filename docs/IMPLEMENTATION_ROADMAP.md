# Implementation roadmap

Legend: [x] built and typechecked/built · [~] built, needs a live database to verify · [ ] not started

## Phase 1: Foundation
- [x] Next.js 16, strict TypeScript, Tailwind v4, supplied design system and layout shell
- [x] Hugeicons-only icon registry; custom components, no UI library
- [x] Full Prisma schema for every phase; client generation
- [x] Permission model and server-side RBAC
- [x] Docs (this folder)

## Phase 2: Identity and academic setup
- [x] Smart ID credential format, hashing, constant-time verification (unit tested)
- [~] Smart ID login (kiosk, teacher), revoke / suspend / replace, card print and PDF
- [~] Admin login (argon2id, lockout), `create-admin` script
- [~] Device enrollment with non-extractable keys and a policy flag
- [~] Academic years, departments, courses, classes and divisions, subjects, periods, classrooms
- [~] Students and teachers: CRUD, enrollment, transfer, CSV import/export
- [~] Timetable builder with teacher / classroom / class conflict detection (conflict logic unit tested)
- [~] Teacher and student dashboards: today and weekly timetable, notifications
- [~] Audit and sign-in logs
- [ ] Playwright end-to-end run of the two workflows

## Phase 3: Live classroom *(next)*
- [ ] Realtime service (Socket.IO), session start/end, presence
- [ ] Attendance (manual, QR, auto from presence), reports
- [ ] Smart board view and WebRTC signalling

## Phase 4: Learning work
- [ ] Assignments and submissions (R2 uploads)
- [ ] Quizzes (live and scheduled), results
- [ ] Library and study material

## Phase 5: Digital twin
- [ ] Portfolio, growth and engagement indicators

## Phase 6: AI
- [ ] Groq gateway (server-only), usage logging, rate limits
- [ ] Teacher and student copilot

## Phase 7: Restricted browser and devices
- [ ] Managed-browser / MDM / device-agent integration (outside the web app)
- [ ] Policy enforcement reporting

## Phase 8: Hardening
- [ ] Load, accessibility and security review; backups; monitoring

## Phase 9: Deployment
- [ ] Production environment, secrets management, runbooks
