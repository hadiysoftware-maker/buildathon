import { NextResponse } from "next/server";
import { assertSameOrigin, handle } from "@/lib/api";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: s.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId: s.userId, readAt: null } }),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  });
}

/** Mark all of the caller's notifications read. */
export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requireSession();
    await prisma.notification.updateMany({ where: { userId: s.userId, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}
