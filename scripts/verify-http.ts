/**
 * HTTP-level check against a running dev server (default http://localhost:3000):
 * card login → /student renders → revoke card → same cookie is rejected on the next request.
 * Run: npx tsx --conditions=react-server scripts/verify-http.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { issueCredential, setCredentialStatus } from "../src/lib/auth/smart-id";

const base = process.env.VERIFY_BASE ?? "http://localhost:3000";
const ok = (c: boolean, m: string) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) process.exitCode = 1; };

async function main() {
  const inst = await prisma.institution.findFirstOrThrow();
  const role = await prisma.role.findUniqueOrThrow({ where: { institutionId_key: { institutionId: inst.id, key: "STUDENT" } } });
  const user = await prisma.user.create({
    data: { institutionId: inst.id, fullName: "Http Flow Student", roles: { create: { roleId: role.id } }, student: { create: { institutionId: inst.id, studentCode: `HF${Date.now() % 1e8}`, admissionNumber: `HF-${Date.now()}` } } },
  });
  try {
    const c = await issueCredential({ institutionId: inst.id, userId: user.id });
    const login = (payload: string, portal: string) =>
      fetch(`${base}/api/auth/smart-id`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ payload, portal }) });

    const wrongPortal = await login(c.payload, "teacher");
    ok(wrongPortal.status === 403, `student card on teacher portal → ${wrongPortal.status}`);

    const res = await login(c.payload, "kiosk");
    const body = (await res.json()) as { ok?: boolean; redirect?: string };
    ok(res.status === 200 && body.ok === true && body.redirect === "/student", `kiosk login → ${res.status} ${body.redirect}`);
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    ok(cookie.startsWith("c35_session="), "session cookie issued");

    const page = await fetch(`${base}/student`, { headers: { cookie }, redirect: "manual" });
    const html = await page.text();
    ok(page.status === 200 && html.includes("Http Flow Student"), `/student renders for the student (${page.status})`);

    const adminPage = await fetch(`${base}/admin`, { headers: { cookie }, redirect: "manual" });
    ok(adminPage.status >= 300 && adminPage.status < 400, `/admin refuses a student session (${adminPage.status})`);

    await setCredentialStatus({ credentialId: c.credentialId, status: "REVOKED", byId: "verify-script" });
    const after = await fetch(`${base}/student`, { headers: { cookie }, redirect: "manual" });
    ok(after.status >= 300 && after.status < 400, `revoked card's session is rejected immediately (${after.status})`);

    const again = await login(c.payload, "kiosk");
    ok(again.status === 403, `revoked card cannot sign in again → ${again.status}`);
  } finally {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.authenticationLog.deleteMany({ where: { userId: user.id } });
    await prisma.smartIdCredential.deleteMany({ where: { userId: user.id } });
    await prisma.studentProfile.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
