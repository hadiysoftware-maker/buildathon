# Authentication

Students and teachers sign in **only** by scanning a Smart ID QR card. They have no password, no username and no recovery email. Administrators sign in separately with email and password.

## Smart ID credential

- The QR code carries `C35:<credentialId>.<secret>`. The secret is 32 random bytes, base64url (43 characters). It contains no personal data.
- The database stores `HMAC-SHA256(secret, SMART_ID_PEPPER)` only. Verification compares in constant time. The secret cannot be recovered, so the QR is **shown once, when issued**; print or save it then. Lost card → **Replace**.
- Status: `ACTIVE`, `SUSPENDED`, `REVOKED`, `REPLACED`. Only `ACTIVE` signs in.
- **Revoke / replace / suspend** change the credential and revoke its sessions in one transaction, so a revoked card is signed out everywhere immediately. A revoked card cannot be reactivated; issue a replacement.
- "Sign out everywhere" ends all of a person's sessions without touching the card.

## Sessions

- Cookie `c35_session`: `HttpOnly`, `Secure` (unless `COOKIE_SECURE=false`), `SameSite=Lax`, `path=/`.
- The cookie holds a random 32-byte token. The database stores its HMAC (`SESSION_PEPPER`), never the token.
- Lifetime by kind: admin 8 h, Smart ID web 10 h, kiosk 8 h.
- **Every request** re-reads the session and re-checks the user's status and the linked credential's status. A change made by an administrator takes effect on the next request, not at token expiry.
- Logout revokes the session row and clears the cookie.

## Administrator login

- `/admin/login`, email + password, hashed with argon2id.
- Five failed attempts lock the account for 15 minutes. The response never reveals whether an email exists.
- The first super admin is created from the command line: `npm run create-admin -- --email … --name …`. The password comes from `ADMIN_PASSWORD` or a hidden prompt, never from an argument.

## Device enrollment

For kiosks and student devices, an institution policy (`requireEnrolledDevice`) can require a trusted device in addition to the card.

1. An admin registers the device and issues a **one-time enrollment code** (stored hashed, expires in 30 minutes).
2. On the device, the browser generates an **ECDSA P-256 key pair with a non-extractable private key** stored in IndexedDB, and sends the public key with the code.
3. At sign-in the server issues a nonce (valid 2 minutes, single use); the device signs it and the server verifies the signature against the registered public key.

A browser fingerprint is never treated as proof of a device. Re-enrolling replaces the key and signs the device out.

## Abuse controls

- Fixed-window rate limits in MySQL (`RateLimitBucket`), by IP and by credential/email.
- Same-origin check on state-changing Route Handlers.
- Every attempt, successful or not, is written to `AuthenticationLog` (result, method, portal, IP, user agent). Admin changes go to `AuditLog`.
- Scanner results are distinct: invalid, revoked, suspended, replaced, inactive account, unauthorised device, rate limited, network error.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/smart-id` | Verify a scanned payload (optionally with a device signature); create a session |
| `POST /api/auth/admin` | Administrator email + password |
| `POST /api/auth/logout` | Revoke the current session |
| `POST /api/devices/challenge` | Issue a device nonce |
| `POST /api/devices/enroll` | Exchange an enrollment code + public key |
