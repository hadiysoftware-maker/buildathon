import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientIp, handle } from "@/lib/api";
import { smartIdLogin } from "@/lib/auth/login";

const Body = z.object({
  payload: z.string().min(10).max(200),
  portal: z.enum(["kiosk", "teacher"]),
  device: z.object({ id: z.string().max(30), nonce: z.string().max(64), signature: z.string().max(200) }).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const body = Body.parse(await req.json());
    const result = await smartIdLogin({
      ...body,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    if (!result.ok) return NextResponse.json({ ok: false, code: result.code }, { status: result.status });
    return NextResponse.json({ ok: true, redirect: result.redirect });
  });
}
