import "server-only";
import { prisma } from "@/lib/db";

/**
 * Fixed-window limiter backed by MySQL. Returns true if the request is allowed.
 * One atomic upsert plus one read (was 2 to 3 queries and racy), all on UTC server time.
 * `failOpen` lets non-security routes (chat, uploads) keep working if the database is briefly unreachable;
 * sign-in limiters leave it off, so they fail closed.
 */
export async function rateLimit(key: string, max: number, windowMs: number, opts: { failOpen?: boolean } = {}): Promise<boolean> {
  try {
    const expired = "TIMESTAMPDIFF(MICROSECOND, `windowStart`, UTC_TIMESTAMP(3)) > ? * 1000";
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`RateLimitBucket\` (\`key\`, \`count\`, \`windowStart\`) VALUES (?, 1, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE \`count\` = IF(${expired}, 1, \`count\` + 1), \`windowStart\` = IF(${expired}, UTC_TIMESTAMP(3), \`windowStart\`)`,
      key, windowMs, windowMs,
    );
    const rows = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>("SELECT `count` FROM `RateLimitBucket` WHERE `key` = ?", key);
    return Number(rows[0]?.count ?? 1) <= max;
  } catch (e) {
    console.error("rateLimit failed", key.split(":")[0], e instanceof Error ? e.message : e);
    if (opts.failOpen) return true;
    throw e;
  }
}
