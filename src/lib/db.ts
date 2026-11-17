import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Small pool: serverless functions (Vercel) and shared MySQL users have tight connection limits.
  const u = new URL(url);
  if (!u.searchParams.has("connectionLimit")) u.searchParams.set("connectionLimit", process.env.DB_POOL_SIZE ?? "5");
  if (!u.searchParams.has("idleTimeout")) u.searchParams.set("idleTimeout", "60");
  return new PrismaClient({ adapter: new PrismaMariaDb(u.toString()) });
}

export const prisma: PrismaClient = globalForPrisma.prismaClient ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaClient = prisma;
