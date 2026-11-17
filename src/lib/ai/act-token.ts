import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * A proposed Copilot action is signed for one user, one kind and one exact set of parameters, and expires.
 * The browser can only press Confirm; it cannot change what will happen, and no other user can replay it.
 */
export type ActKind = "create_assignment" | "create_quiz" | "announce_class" | "log_lesson" | "add_portfolio" | "mark_notifications_read";
export interface ActPayload { u: string; k: ActKind; p: Record<string, unknown>; x: number }

const mac = (body: string) => createHmac("sha256", env.sessionPepper).update(`act:${body}`).digest("base64url");

export function signAct(userId: string, kind: ActKind, params: Record<string, unknown>, ttlMs = 15 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ u: userId, k: kind, p: params, x: Date.now() + ttlMs } satisfies ActPayload)).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function readAct(userId: string, token: string): ActPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = mac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ActPayload;
    return p.u === userId && p.x > Date.now() ? p : null;
  } catch {
    return null;
  }
}
