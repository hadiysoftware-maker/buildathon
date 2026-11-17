import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { decryptChat } from "@/lib/ai/crypto";

/** The caller's own chat history, newest first. */
export async function GET() {
  return handle(async () => {
    const s = await requirePermission("ai.use");
    const items = await prisma.aIConversation.findMany({ where: { userId: s.userId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } });
    return NextResponse.json({ items: items.map((i) => ({ ...i, title: decryptChat(s.userId, i.title) })) });
  });
}
