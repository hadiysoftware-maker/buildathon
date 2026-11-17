import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Small pool: serverless functions (Vercel) and shared MySQL users have tight connection limits.
  const u = new URL(url);
  // Shared MySQL users cap TOTAL connections (max_user_connections). Every warm serverless instance keeps its own pool,
  // so on Vercel each instance gets ONE connection and gives it back after 5 s idle; locally a few more are fine.
  const serverless = !!process.env.VERCEL;
  if (!u.searchParams.has("connectionLimit")) u.searchParams.set("connectionLimit", process.env.DB_POOL_SIZE ?? (serverless ? "1" : "3"));
  if (!u.searchParams.has("minimumIdle")) u.searchParams.set("minimumIdle", "0");
  if (!u.searchParams.has("idleTimeout")) u.searchParams.set("idleTimeout", serverless ? "5" : "60");
  // The driver default connect timeout is 1 s, too short for a remote database from a serverless region (that is the
  // "pool failed to retrieve a connection" error). Give it room and fail clearly instead.
  if (!u.searchParams.has("connectTimeout")) u.searchParams.set("connectTimeout", process.env.DB_CONNECT_TIMEOUT_MS ?? "10000");
  if (!u.searchParams.has("acquireTimeout")) u.searchParams.set("acquireTimeout", process.env.DB_ACQUIRE_TIMEOUT_MS ?? "15000");
  if (!u.searchParams.has("keepAliveDelay")) u.searchParams.set("keepAliveDelay", "10000");
  return new PrismaClient({ adapter: new PrismaMariaDb(u.toString()) });
}

export const prisma: PrismaClient = globalForPrisma.prismaClient ?? create();
// Cache in every environment. In production different route bundles each evaluate this module; without the global
// cache each one opened its own pool, multiplying connections and exhausting the database user limit.
globalForPrisma.prismaClient = prisma;
