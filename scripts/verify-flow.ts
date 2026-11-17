/**
 * Live verification of Workflow B against the configured database (library level, not HTTP):
 * issue → verify → revoke → verify fails → replace → new card verifies, old card does not.
 * Creates and removes its own throwaway student. Run: npx tsx --conditions=react-server scripts/verify-flow.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { issueCredential, replaceCredential, setCredentialStatus, verifyCredential } from "../src/lib/auth/smart-id";

const ok = (c: boolean, m: string) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) process.exitCode = 1; };

async function main() {
  const inst = await prisma.institution.findFirstOrThrow();
  const role = await prisma.role.findUniqueOrThrow({ where: { institutionId_key: { institutionId: inst.id, key: "STUDENT" } } });
  const user = await prisma.user.create({
    data: { institutionId: inst.id, fullName: "Verify Flow Student", roles: { create: { roleId: role.id } }, student: { create: { institutionId: inst.id, studentCode: `VF${Date.now() % 1e8}`, admissionNumber: `VF-${Date.now()}` } } },
  });
  try {
    const c1 = await issueCredential({ institutionId: inst.id, userId: user.id });
    const r1 = await verifyCredential(c1.payload);
    ok(r1.ok === true, "issued card verifies");
    const bad = await verifyCredential(c1.payload.slice(0, -3) + "AAA");
    ok(bad.ok === false, "tampered secret is rejected");

    await setCredentialStatus({ credentialId: c1.credentialId, status: "REVOKED", byId: "verify-script" });
    const r2 = await verifyCredential(c1.payload);
    ok(r2.ok === false, `revoked card is rejected (${"code" in r2 ? r2.code : ""})`);

    const c2 = await issueCredential({ institutionId: inst.id, userId: user.id, cardNumber: 2 });
    const c3 = await replaceCredential({ credentialId: c2.credentialId, byId: "verify-script" });
    ok((await verifyCredential(c2.payload)).ok === false, "replaced (old) card is rejected");
    ok((await verifyCredential(c3.payload)).ok === true, "replacement card verifies");

    await prisma.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
    ok((await verifyCredential(c3.payload)).ok === false, "inactive account is rejected");
  } finally {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.authenticationLog.deleteMany({ where: { userId: user.id } });
    await prisma.smartIdCredential.updateMany({ where: { userId: user.id }, data: { replacedById: null } });
    await prisma.smartIdCredential.deleteMany({ where: { userId: user.id } });
    await prisma.studentProfile.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
