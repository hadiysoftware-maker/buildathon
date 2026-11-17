import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientIp, handle } from "@/lib/api";
import { hashEnrollmentCode } from "@/lib/auth/device";
import { rateLimit } from "@/lib/auth/rate-limit";
import { logAuth } from "@/lib/auth/log";
import { prisma } from "@/lib/db";

const Body = z.object({
  code: z.string().min(8).max(64),
  publicKeyJwk: z.object({ kty: z.literal("EC"), crv: z.literal("P-256"), x: z.string(), y: z.string() }),
});

/** One-time enrollment: the kiosk registers the public half of a non-extractable key pair. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const ip = clientIp(req);
    if (!(await rateLimit(`enroll:${ip}`, 10, 300_000))) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }
    const body = Body.parse(await req.json());
    const device = await prisma.registeredDevice.findFirst({
      where: { enrollmentCodeHash: hashEnrollmentCode(body.code), status: "PENDING", enrollmentExpiresAt: { gt: new Date() } },
    });
    if (!device) return NextResponse.json({ error: "Invalid or expired enrollment code" }, { status: 400 });
    const { kty, crv, x, y } = body.publicKeyJwk;
    await prisma.registeredDevice.update({
      where: { id: device.id },
      data: {
        status: "ACTIVE",
        publicKeyJwk: { kty, crv, x, y },
        enrolledAt: new Date(),
        enrollmentCodeHash: null,
        enrollmentExpiresAt: null,
      },
    });
    await logAuth({ institutionId: device.institutionId, deviceId: device.id, method: "DEVICE_ENROLLMENT", result: "SUCCESS", ip, userAgent: req.headers.get("user-agent") });
    return NextResponse.json({ deviceId: device.id });
  });
}
