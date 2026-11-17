import { NextResponse } from "next/server";
import { assertSameOrigin, handle } from "@/lib/api";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requireSession();
    const { id } = await ctx.params;
    // userId in the filter makes this a no-op for someone else's notification.
    await prisma.notification.updateMany({ where: { id, userId: s.userId, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}
