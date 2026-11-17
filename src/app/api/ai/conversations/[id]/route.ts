import { NextResponse } from "next/server";
import { assertSameOrigin, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const s = await requirePermission("ai.use");
    const { id } = await params;
    const c = await prisma.aIConversation.findFirst({ where: { id, userId: s.userId }, select: { id: true } });
    if (!c) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await prisma.aIMessage.findMany({ where: { conversationId: id, role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, role: true, content: true } });
    return NextResponse.json({ messages });
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requirePermission("ai.use");
    const { id } = await params;
    const r = await prisma.aIConversation.deleteMany({ where: { id, userId: s.userId } });
    return NextResponse.json({ ok: r.count > 0 });
  });
}
