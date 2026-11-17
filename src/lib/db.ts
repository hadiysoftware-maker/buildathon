import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
}

export const prisma: PrismaClient = globalForPrisma.prismaClient ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaClient = prisma;
