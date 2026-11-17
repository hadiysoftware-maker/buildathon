import "server-only";
import { randomInt } from "node:crypto";

/** Run `create` with a freshly generated code, retrying on unique-constraint collisions. */
export async function withUniqueCode<T>(prefix: string, create: (code: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < 6; i++) {
    const code = `${prefix}${randomInt(100000, 1000000)}`;
    try {
      return await create(code);
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
      lastError = e;
    }
  }
  throw lastError;
}
