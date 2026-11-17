# EduCore: System architecture

## Shape

One Next.js 16 (App Router) application backed by **MySQL 8 through Prisma**. There is no other datastore.

```
Browser (kiosk / teacher / admin)
   │  HTTPS, HttpOnly session cookie
   ▼
Next.js app ── Server Components (read data)  ── Prisma ──► MySQL 8
            ├─ Server Actions   (admin writes: validated with zod, permission-checked, audited)
            └─ Route Handlers   (/api/auth/*, /api/devices/*, /api/notifications/*)
```

Layers, from outside in:

| Layer | Location | Rule |
|---|---|---|
| UI | `src/components`, `src/app/**/page.tsx` | Presentation only. Pages call a guard (`requirePagePermission` / `requireRolePage`) themselves; layouts are not a security boundary. |
| Features | `src/features/*` | Server Actions (`actions.ts`) and the client components that call them. Every action goes through `action(permission, fn, revalidatePaths)` in `features/shared.ts`. |
| Domain / auth | `src/lib/auth`, `src/lib/permissions`, `src/lib/timetable` | Pure logic plus Prisma access. No React. |
| Data | `prisma/schema.prisma`, `src/lib/db.ts` | One shared client using the MariaDB driver adapter. |

## Request flow for a protected write

1. A client component calls a Server Action.
2. `action()` resolves the session (`getSession`), which re-checks the account and the Smart ID credential in the database on every request.
3. `requirePermission(perm)` checks the role's permission set.
4. Input is parsed with zod; Prisma runs the change (in a transaction where several rows move together).
5. An `AuditLog` row is written, and the listed paths are revalidated.
6. The action returns `{ ok: true, data }` or `{ ok: false, error }`. Known failures (`UserError`, unique violations, missing rows) become readable messages; unexpected errors are logged and returned as a generic message.

## Multi-tenancy

Every top-level row carries `institutionId`, and every query filters on the session's `institutionId`. A person from one institution can never load another's rows, even by guessing ids.

## Planned services (not built in this pass)

These are scoped in the schema and roadmap but intentionally not implemented yet. Nothing in the UI pretends they work.

- **Realtime service** (`realtime/`, separate Node process, Socket.IO). Carries live-class presence, attendance prompts, quiz state and notifications. It authenticates with the same session cookie by calling a small internal verification endpoint. WebRTC **signalling** for the smart board also lives here; media goes peer-to-peer or through a TURN server.
- **AI gateway.** A server-only module that calls Groq. API keys never reach the browser; every prompt/response is logged to `AiRequestLog`, role-scoped, and rate-limited.
- **Object storage (Cloudflare R2).** Files live in R2; MySQL stores only the object key and metadata. Uploads use short-lived presigned URLs.
- **Restricted browser / device control.** A web page cannot lock a device. Enforcing kiosk mode, blocking other apps or controlling a student device needs a managed browser, MDM or a device agent. This app records which devices are enrolled and trusted (see AUTHENTICATION.md) and exposes the policy flag; the enforcement agent is a separate integration.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL 8 connection string (required) |
| `SMART_ID_PEPPER` | Server secret mixed into stored Smart ID secret hashes |
| `SESSION_PEPPER` | Server secret mixed into stored session token hashes |
| `COOKIE_SECURE` | `false` only for plain-http local development |

Rotating a pepper invalidates every card or session that used it, so treat it as a long-lived secret.
