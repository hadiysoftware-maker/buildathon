import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { agentChat, aiConfigured, aiModel, type ChatMessage } from "@/lib/ai/gateway";
import { runTool, toolSpecs } from "@/lib/ai/tools";
import { routeIntent } from "@/lib/ai/router";
import { systemPromptFor } from "@/lib/ai/context";
import { frame, packMessage, unpackMessage, type Block } from "@/lib/ai/blocks";
import { chatCryptoConfigured, decryptChat, encryptChat } from "@/lib/ai/crypto";

const Body = z.object({
  conversationId: z.string().regex(/^[a-z0-9]{10,30}$/).optional(),
  message: z.string().trim().min(1, "Type a message").max(4000),
});

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HISTORY = 8; // fewer past turns keeps each request small

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requirePermission("ai.use");
    if (!chatCryptoConfigured()) return NextResponse.json({ error: "Chat encryption is not configured. Ask an administrator to set CHAT_ENCRYPTION_KEY." }, { status: 503 });
    if (!(await rateLimit(`ai:${s.userId}`, 15, 60_000))) return NextResponse.json({ error: "You are sending messages too quickly. Wait a moment." }, { status: 429 });

    const { conversationId, message } = Body.parse(await req.json());

    // Conversations are private to their owner.
    // The client picks the id up front, so retries and double clicks reuse one conversation instead of creating two.
    let convo = conversationId ? await prisma.aIConversation.findUnique({ where: { id: conversationId } }) : null;
    if (convo && convo.userId !== s.userId) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    if (!convo) {
      try {
        convo = await prisma.aIConversation.create({ data: { ...(conversationId ? { id: conversationId } : {}), userId: s.userId, title: encryptChat(s.userId, message.slice(0, 80)), contextType: s.role.toLowerCase() } });
      } catch (e) {
        // A parallel request created it first: use that one.
        convo = conversationId ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId: s.userId } }) : null;
        if (!convo) throw e;
      }
    }

    // Zero-token path: plain data questions run the role-scoped tools directly, with no model call.
    const routed = routeIntent(message, s.role);
    if (routed) {
      const started0 = Date.now();
      const blocks: Block[] = [];
      const lines: string[] = [];
      if (routed.kind === "text") lines.push(routed.text);
      else {
        for (const st of routed.steps) {
          const r = await runTool(s, st.tool, JSON.stringify(st.args));
          blocks.push(...r.blocks);
          lines.push(r.blocks.length ? st.lead : `${st.lead} Nothing to show yet.`);
        }
      }
      const text = [...new Set(lines)].join(" ");
      await prisma.aIMessage.create({ data: { conversationId: convo.id, role: "USER", content: encryptChat(s.userId, message) } });
      await prisma.aIMessage.create({ data: { conversationId: convo.id, role: "ASSISTANT", content: encryptChat(s.userId, packMessage(text, blocks)), tokensIn: 0, tokensOut: 0 } });
      await prisma.aIConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
      await prisma.aIUsageRecord.create({ data: { institutionId: s.institutionId, userId: s.userId, model: "router", purpose: "copilot", promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - started0 } });
      return new Response(blocks.slice(0, 4).map(frame).join("") + text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-conversation-id": convo.id } });
    }
    if (!aiConfigured()) return NextResponse.json({ error: "The AI copilot is not configured yet. Ask an administrator to set GROQ_API_KEY." }, { status: 503 });

    // Independent reads run together; the new user message is saved while the model works.
    const [past, system] = await Promise.all([
      prisma.aIMessage.findMany({ where: { conversationId: convo.id, role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "desc" }, take: HISTORY }),
      systemPromptFor(s),
    ]);
    const saveUser = prisma.aIMessage.create({ data: { conversationId: convo.id, role: "USER", content: encryptChat(s.userId, message) } });

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...past.reverse().map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: unpackMessage(decryptChat(s.userId, m.content)).text })), // text only: visuals are not sent back to the model
      { role: "user", content: message },
    ];

    const started = Date.now();
    const cid = convo.id;
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await agentChat(messages, toolSpecs(s.role), (name, args) => runTool(s, name, args), async (full, usage, blocks) => {
      if (full) {
        await prisma.aIMessage.create({ data: { conversationId: cid, role: "ASSISTANT", content: encryptChat(s.userId, packMessage(full, blocks)), tokensIn: usage.promptTokens, tokensOut: usage.completionTokens } });
        await prisma.aIConversation.update({ where: { id: cid }, data: { updatedAt: new Date() } });
      }
      await prisma.aIUsageRecord.create({
        data: { institutionId: s.institutionId, userId: s.userId, model: aiModel(), purpose: "copilot", promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, latencyMs: Date.now() - started },
      });
    }, { signal: req.signal });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "The AI service could not answer." }, { status: 502 });
    }

    await saveUser;
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-conversation-id": convo.id } });
  });
}
