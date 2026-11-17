import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { audit } from "@/lib/auth/log";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { decryptChat } from "@/lib/ai/crypto";

/** The caller's own chat history, newest first. */
export async function GET() {
  return handle(async () => {
    const s = await requirePermission("ai.use");
    const items = await prisma.aIConversation.findMany({ where: { userId: s.userId, contextType: { not: "memory" } }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } });
    return NextResponse.json({ items: items.map((i) => ({ ...i, title: decryptChat(s.userId, i.title) })) });
  });
}

const Bulk = z.object({ ids: z.array(z.string().regex(/^[a-z0-9]{10,30}$/)).min(1).max(100) });

/** Deletes several of the caller's own chats at once. Ids that are not theirs are silently ignored (count tells the truth). */
export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requirePermission("ai.use");
    const { ids } = Bulk.parse(await req.json());
    const r = await prisma.aIConversation.deleteMany({ where: { id: { in: ids }, userId: s.userId, contextType: { not: "memory" } } });
    if (r.count > 0) await audit({ institutionId: s.institutionId, actorId: s.userId, action: "copilot.chats.delete", entityType: "AIConversation", entityId: String(r.count) });
    return NextResponse.json({ deleted: r.count });
  });
}
