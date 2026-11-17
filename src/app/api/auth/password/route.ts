import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientIp, handle } from "@/lib/api";
import { passwordLogin } from "@/lib/auth/password-login";

const Body = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200), portal: z.enum(["kiosk", "teacher"]) });

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const body = Body.parse(await req.json());
    const r = await passwordLogin({ ...body, ip: clientIp(req), userAgent: req.headers.get("user-agent") });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, redirect: r.redirect });
  });
}
