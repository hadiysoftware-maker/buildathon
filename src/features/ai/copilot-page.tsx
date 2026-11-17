import "server-only";
import { prisma } from "@/lib/db";
import type { CurrentSession } from "@/lib/auth/session";
import { aiConfigured } from "@/lib/ai/gateway";
import { suggestionsFor } from "@/lib/ai/context";
import { decryptChat } from "@/lib/ai/crypto";
import { CopilotChat } from "./CopilotChat";

/** Server half of the copilot page, shared by the admin, teacher and student portals. */
export async function CopilotPage({ s, searchParams, base, eyebrow }: { s: CurrentSession; searchParams: Promise<{ c?: string }>; base: string; eyebrow: string }) {
  const { c } = await searchParams;
  const conversations = await prisma.aIConversation.findMany({ where: { userId: s.userId }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, title: true } });
  const active = c ? conversations.find((x) => x.id === c) ?? (await prisma.aIConversation.findFirst({ where: { id: c, userId: s.userId }, select: { id: true, title: true } })) : null;
  const messages = active
    ? await prisma.aIMessage.findMany({ where: { conversationId: active.id, role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, role: true, content: true } })
    : [];
  return (
    <CopilotChat
      key={active?.id ?? "new"}
      base={base}
      eyebrow={eyebrow}
      aiReady={aiConfigured()}
      conversations={conversations.map((x) => ({ ...x, title: decryptChat(s.userId, x.title) }))}
      activeId={active?.id ?? null}
      initial={messages.map((m) => ({ id: m.id, role: m.role as "USER" | "ASSISTANT", content: decryptChat(s.userId, m.content) }))}
      suggestions={suggestionsFor(s.role)}
    />
  );
}
