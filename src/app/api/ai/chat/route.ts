import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { agentChat, aiConfigured, aiModel, visionModels, type ChatMessage, type ContentPart } from "@/lib/ai/gateway";
import { ATTACH_RULES, AttachmentError, loadChatFiles, textBlock } from "@/lib/ai/attachments";
import { isResearchApproval, needsDocs, runTool, toolLabel, toolSpecs } from "@/lib/ai/tools";
import { fanOut, routeIntent } from "@/lib/ai/router";
import { systemPromptFor } from "@/lib/ai/context";
import { frame, packMessage, unpackMessage, type Block } from "@/lib/ai/blocks";
import { addMemory, clearMemory, memoryPrompt, parseMemoryCommand, readMemory } from "@/lib/ai/memory";
import { chatCryptoConfigured, decryptChat, encryptChat } from "@/lib/ai/crypto";

const Body = z.object({
  conversationId: z.string().regex(/^[a-z0-9]{10,30}$/).optional(),
  message: z.string().trim().min(1, "Type a message").max(4000),
  attachments: z.array(z.string().regex(/^[a-zA-Z0-9]{10,30}$/)).max(3).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const FILE_TOOLS = new Set(["make_quiz", "make_pdf_report", "show_summary"]);
const HISTORY = 8; // fewer past turns keeps each request small

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requirePermission("ai.use");
    if (!chatCryptoConfigured()) return NextResponse.json({ error: "Chat encryption is not configured. Ask an administrator to set CHAT_ENCRYPTION_KEY." }, { status: 503 });
    if (!(await rateLimit(`ai:${s.userId}`, 15, 60_000, { failOpen: true }))) return NextResponse.json({ error: "You are sending messages too quickly. Wait a moment." }, { status: 429 });

    const { conversationId, message, attachments } = Body.parse(await req.json());

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

    // Memory commands ("remember that ...", "forget everything", "what do you remember") are answered without the model.
    const mem = attachments?.length ? null : parseMemoryCommand(message);
    if (mem) {
      let reply: string;
      if (mem.kind === "remember") reply = (await addMemory(s.userId, mem.note)) === "saved" ? "Got it, I will remember that. Say “forget everything” any time to clear my memory of you." : "My memory of you is full (20 notes). Say “forget everything” to start fresh.";
      else if (mem.kind === "forget") reply = (await clearMemory(s.userId)) ? "Done. I have forgotten everything you asked me to remember." : "I had nothing saved about you.";
      else { const n = await readMemory(s.userId); reply = n.length ? `Here is what I remember:\n${n.map((x) => `- ${x.note}`).join("\n")}` : "You have not asked me to remember anything yet. Try “remember that I prefer short answers”."; }
      await prisma.aIMessage.create({ data: { conversationId: convo.id, role: "USER", content: encryptChat(s.userId, message) } });
      await prisma.aIMessage.create({ data: { conversationId: convo.id, role: "ASSISTANT", content: encryptChat(s.userId, packMessage(reply, [])), tokensIn: 0, tokensOut: 0 } });
      await prisma.aIConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
      return new Response(reply, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-transform", "x-conversation-id": convo.id } });
    }

    // Zero-token path: plain data questions run the role-scoped tools directly, with no model call.
    const routed = attachments?.length ? null : routeIntent(message, s.role); // a message with files always goes to the model
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
      return new Response(blocks.slice(0, 4).map(frame).join("") + text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-transform", "x-conversation-id": convo.id } });
    }
    if (!aiConfigured()) return NextResponse.json({ error: "The AI copilot is not configured yet. Ask an administrator to set GROQ_API_KEY." }, { status: 503 });

    // Independent reads run together; the new user message is saved while the model works.
    const [past, system0, notes] = await Promise.all([
      prisma.aIMessage.findMany({ where: { conversationId: convo.id, role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "desc" }, take: HISTORY }),
      systemPromptFor(s),
      readMemory(s.userId).catch(() => []),
    ]);
    const system = system0 + memoryPrompt(notes);
    const hist = past.reverse().map((m) => ({ role: m.role, u: unpackMessage(decryptChat(s.userId, m.content)) }));

    // Files: this message's attachments, or (for a follow-up) the most recent files in the conversation.
    let att;
    try {
      att = await loadChatFiles(s.userId, s.institutionId, attachments ?? []);
    } catch (e) {
      if (e instanceof AttachmentError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    const prior = attachments?.length ? undefined : [...hist].reverse().find((h) => h.role === "USER" && h.u.files?.length);
    const priorImages = prior ? await loadChatFiles(s.userId, s.institutionId, prior.u.files!.filter((f) => f.mime.startsWith("image/")).map((f) => f.id)).catch(() => null) : null;
    const images = [...att.images, ...(priorImages?.images ?? [])].slice(0, 3);
    const fileText = att.texts.length ? textBlock(att.texts) : prior?.u.x ?? "";
    const hasFiles = images.length > 0 || !!fileText || att.notes.length > 0;
    const stored = att.files.length ? { files: att.files, x: fileText.slice(0, 14_000) } : undefined;
    // Saved before the model runs so the question always sorts ahead of the answer (Prisma queries are lazy and only start when awaited).
    await prisma.aIMessage.create({ data: { conversationId: convo.id, role: "USER", content: encryptChat(s.userId, packMessage(message, [], stored)) } });

    const userText = [message, fileText, ...att.notes.map((n) => `(Note: ${n})`)].filter(Boolean).join("\n\n");
    const userContent: string | ContentPart[] = images.length
      ? [{ type: "text", text: userText }, ...images.map((i): ContentPart => ({ type: "image_url", image_url: { url: i.dataUrl } }))]
      : userText;
    const messages: ChatMessage[] = [
      { role: "system", content: (hasFiles ? `${system}
${ATTACH_RULES}` : system) + (isResearchApproval(userText) ? " The user APPROVED web research. Call web_research once with their question (and any links they gave), then write the real answer or analysis from the source text (key facts, short sections, a simple explanation), NOT a list of the sources, using ONLY its sources and citing them as [1], [2]. The source cards are shown, so do not list links. Mention anything the sources do not cover." : /^approved/i.test(userText) ? " The user has APPROVED the plan. The planning and question tools are unavailable now: call the file tool directly and finish." : "") },
      ...hist.map((h) => ({ role: h.role === "USER" ? ("user" as const) : ("assistant" as const), content: h.u.text })), // text only: visuals are not sent back to the model
      { role: "user", content: userContent },
    ];

    const started = Date.now();
    const cid = convo.id;
    let stream: ReadableStream<Uint8Array>;
    try {
      const done = async (full: string, usage: { promptTokens?: number; completionTokens?: number }, blocks: Block[]) => {
      if (full) {
        await prisma.aIMessage.create({ data: { conversationId: cid, role: "ASSISTANT", content: encryptChat(s.userId, packMessage(full, blocks)), tokensIn: usage.promptTokens, tokensOut: usage.completionTokens } });
        await prisma.aIConversation.update({ where: { id: cid }, data: { updatedAt: new Date() } });
      }
      await prisma.aIUsageRecord.create({
        data: { institutionId: s.institutionId, userId: s.userId, model: aiModel(), purpose: "copilot", promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, latencyMs: Date.now() - started },
      });
      };
      stream = hasFiles
        ? await agentChat(
            messages,
            // Images go to the vision model, which answers in plain text. Text and PDF files may also produce a quiz card, summary or PDF report.
            images.length ? [] : toolSpecs(s.role).filter((t) => FILE_TOOLS.has(t.function.name)),
            (name, args) => (FILE_TOOLS.has(name) ? runTool(s, name, args) : Promise.resolve({ content: "{}", blocks: [] })),
            done,
            { signal: req.signal, models: images.length ? visionModels() : undefined, maxTokens: 1600, maxRounds: images.length ? 1 : 3, label: toolLabel },
          )
        : await agentChat(messages, toolSpecs(s.role, message), (name, args) => (name === "web_research" && !isResearchApproval(message) ? Promise.resolve({ content: JSON.stringify({ error: "Research needs the user's approval first." }), blocks: [] }) : runTool(s, name, args)), done, { signal: req.signal, label: toolLabel, prefetch: fanOut(message, s.role) ?? undefined, ...(needsDocs(message) ? { maxTokens: 2800, maxRounds: 5 } : {}) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "The AI service could not answer." }, { status: 502 });
    }

    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-transform", "x-conversation-id": convo.id } });
  });
}
