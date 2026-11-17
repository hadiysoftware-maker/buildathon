import "server-only";
import { prisma } from "@/lib/db";

/** Fixed-window limiter backed by MySQL. Returns true if the request is allowed. */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!row || now.getTime() - row.windowStart.getTime() > windowMs) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return true;
  }
  if (row.count >= max) return false;
  await prisma.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}
