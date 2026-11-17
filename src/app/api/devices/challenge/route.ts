import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientIp, handle } from "@/lib/api";
import { issueChallenge } from "@/lib/auth/device";
import { rateLimit } from "@/lib/auth/rate-limit";

const Body = z.object({ deviceId: z.string().min(10).max(30) });

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    if (!(await rateLimit(`challenge:${clientIp(req)}`, 60, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const { deviceId } = Body.parse(await req.json());
    const nonce = await issueChallenge(deviceId);
    if (!nonce) return NextResponse.json({ error: "Device not authorized" }, { status: 403 });
    return NextResponse.json({ nonce });
  });
}
