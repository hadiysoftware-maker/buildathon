/**
 * Create (or reset the password of) an administrator.
 *
 *   npm run create-admin -- --email you@school.org --name "Your Name" [--username name] [--role SUPER_ADMIN|ADMIN] [--institution CODE]
 *
 * The password is read from the ADMIN_PASSWORD environment variable, or prompted for with echo
 * disabled. It is never accepted as a command-line argument (those leak into shell history and process lists).
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { hash } from "@node-rs/argon2";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function promptHidden(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const w = rl as unknown as { _writeToOutput: (s: string) => void };
    w._writeToOutput = (s: string) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const email = arg("email")?.trim().toLowerCase();
  const fullName = arg("name")?.trim();
  const username = arg("username")?.trim().toLowerCase();
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("--username must be 3-40 letters, digits, dot, dash or underscore");
  const roleKey = (arg("role") ?? "SUPER_ADMIN") as "SUPER_ADMIN" | "ADMIN";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is required and must be a valid address");
  if (!fullName) throw new Error("--name is required");
  if (roleKey !== "SUPER_ADMIN" && roleKey !== "ADMIN") throw new Error("--role must be SUPER_ADMIN or ADMIN");

  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password (min 12 chars): "));
  const minLen = process.env.NODE_ENV === "production" ? 12 : 6;
  if (password.length < minLen) throw new Error(`Password must be at least ${minLen} characters.`);

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  try {
    const inst = arg("institution")
      ? await prisma.institution.findUnique({ where: { code: arg("institution")! } })
      : await prisma.institution.findFirst({ orderBy: { createdAt: "asc" } });
    if (!inst) throw new Error("No institution found. Run `npm run db:seed` first.");
    const role = await prisma.role.findUnique({ where: { institutionId_key: { institutionId: inst.id, key: roleKey } } });
    if (!role) throw new Error("Roles are missing. Run `npm run db:seed` first.");

    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const existing = await prisma.user.findFirst({ where: { institutionId: inst.id, email } });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, fullName, ...(username ? { username } : {}), status: "ACTIVE", failedLogins: 0, lockedUntil: null } })
      : await prisma.user.create({ data: { institutionId: inst.id, email, username, fullName, passwordHash } });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
    await prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "PASSWORD_RESET" } });
    console.log(`${existing ? "Updated" : "Created"} ${roleKey} ${email}. Sign in at /admin/login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
