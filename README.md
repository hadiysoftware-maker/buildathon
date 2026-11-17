# EduCore

Smart-classroom OS / digital campus platform. This first pass covers the foundation, academic setup, Smart ID login (students and teachers scan a QR card; admins use email + password) and the teacher and student dashboards. Later phases (live class, attendance, assignments, quizzes, library, digital twin, AI) are documented in `docs/IMPLEMENTATION_ROADMAP.md` and are not built yet.

Stack: Next.js 16 (App Router), React 19, strict TypeScript, Tailwind v4, MySQL 8 + Prisma, Hugeicons. No other UI library.

## Run it

1. Create an empty MySQL 8 database.
2. `cp .env.example .env` and fill in `DATABASE_URL`, `SMART_ID_PEPPER`, `SESSION_PEPPER` (generate each with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Set `COOKIE_SECURE=false` for plain-http local development.

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed                    # or: SEED_DEMO=true npm run db:seed  (adds a labelled demo structure)
npm run create-admin -- --email you@school.org --name "Your Name"
npm run dev
```

Sign in at `/admin/login`. Create an academic year (and activate it), classes, students and teachers, then issue Smart ID cards from **Smart ID cards**. **Print or save a card when it is issued: the QR secret cannot be shown again.** Students use `/kiosk/login`, teachers `/teacher/login`.

## Checks

```bash
npm run typecheck
npm run lint
npm test            # unit tests (no database needed)
npm run test:e2e    # Playwright; admin test needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
```

## Docs

`docs/` holds the architecture, schema, authentication, permissions, design system, component catalogue, API and roadmap.
