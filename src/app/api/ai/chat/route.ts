import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { aiConfigured, aiModel, streamChat, type ChatMessage } from "@/lib/ai/gateway";
import { systemPromptFor } from "@/lib/ai/context";
import { chatCryptoConfigured, decryptChat, encryptChat } from "@/lib/ai/crypto";

const Body = z.object({
  conversationId: z.string().max(30).optional(),
  message: z.string().trim().min(1, "Type a message").max(4000),
});

const HISTORY = 12;

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requirePermission("ai.use");
    if (!aiConfigured()) return NextResponse.json({ error: "The AI copilot is not configured yet. Ask an administrator to set GROQ_API_KEY." }, { status: 503 });
    if (!chatCryptoConfigured()) return NextResponse.json({ error: "Chat encryption is not configured. Ask an administrator to set CHAT_ENCRYPTION_KEY." }, { status: 503 });
    if (!(await rateLimit(`ai:${s.userId}`, 15, 60_000))) return NextResponse.json({ error: "You are sending messages too quickly. Wait a moment." }, { status: 429 });

    const { conversationId, message } = Body.parse(await req.json());

    // Conversations are private to their owner.
    let convo = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: s.userId } }) : null;
    if (conversationId && !convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    convo ??= await prisma.aIConversation.create({ data: { userId: s.userId, title: encryptChat(s.userId, message.slice(0, 80)), contextType: s.role.toLowerCase() } });

    const past = await prisma.aIMessage.findMany({ where: { conversationId: convo.id, role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "desc" }, take: HISTORY });
    await prisma.aIMessage.create({ data: { conversationId: convo.id, role: "USER", content: encryptChat(s.userId, message) } });

    const messages: ChatMessage[] = [
      { role: "system", content: await systemPromptFor(s) },
      ...past.reverse().map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: decryptChat(s.userId, m.content) })),
      { role: "user", content: message },
    ];

    const started = Date.now();
    const cid = convo.id;
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await streamChat(messages, async (full, usage) => {
      if (full) {
        await prisma.aIMessage.create({ data: { conversationId: cid, role: "ASSISTANT", content: encryptChat(s.userId, full), tokensIn: usage.promptTokens, tokensOut: usage.completionTokens } });
        await prisma.aIConversation.update({ where: { id: cid }, data: { updatedAt: new Date() } });
      }
      await prisma.aIUsageRecord.create({
        data: { institutionId: s.institutionId, userId: s.userId, model: aiModel(), purpose: "copilot", promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, latencyMs: Date.now() - started },
      });
    }, { signal: req.signal });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "The AI service could not answer." }, { status: 502 });
    }

    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-conversation-id": convo.id } });
  });
}
