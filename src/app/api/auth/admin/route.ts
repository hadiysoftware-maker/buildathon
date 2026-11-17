import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientIp, handle } from "@/lib/api";
import { adminLogin } from "@/lib/auth/admin-login";

const Body = z.object({ identifier: z.string().trim().min(1).max(191), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const body = Body.parse(await req.json());
    const r = await adminLogin({ ...body, ip: clientIp(req), userAgent: req.headers.get("user-agent") });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, redirect: "/admin" });
  });
}
