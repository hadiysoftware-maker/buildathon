import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guards";

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Uniform JSON error handling for Route Handlers. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: e.issues.map((i) => i.message) }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** Reject cross-site state-changing requests (CSRF defence in depth on top of SameSite=Lax). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  if (host && new URL(origin).host !== host) throw new AuthError(403, "Cross-origin request blocked");
}
