import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** A signed "you started at T" ticket, so the quiz timer is enforced on the server without extra tables. */
export function signStart(quizId: string, userId: string, at = Date.now()): string {
  const mac = createHmac("sha256", env.sessionPepper).update(`quiz:${quizId}:${userId}:${at}`).digest("hex").slice(0, 32);
  return `${at}.${mac}`;
}

export function readStart(quizId: string, userId: string, token: string): number | null {
  const [ts, mac] = token.split(".");
  const at = Number(ts);
  if (!Number.isFinite(at) || !mac) return null;
  const want = signStart(quizId, userId, at).split(".")[1];
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? at : null;
}
