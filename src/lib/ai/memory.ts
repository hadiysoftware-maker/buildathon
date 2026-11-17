import "server-only";
import { prisma } from "@/lib/db";
import { decryptChat, encryptChat } from "@/lib/ai/crypto";

/**
 * Long-term memory: short notes the user asked Nova to remember ("remember that I study for JEE").
 * Notes live as encrypted SYSTEM messages in one hidden conversation per user (contextType "memory"),
 * so they use the same per-user encryption as chats and need no schema change. The history lists skip it.
 */
export const MEMORY_TYPE = "memory";
const MAX_NOTES = 20;
const MAX_NOTE = 300;

async function memoryConvo(userId: string, create: boolean) {
  const found = await prisma.aIConversation.findFirst({ where: { userId, contextType: MEMORY_TYPE }, select: { id: true } });
  if (found || !create) return found;
  return prisma.aIConversation.create({ data: { userId, contextType: MEMORY_TYPE, title: encryptChat(userId, "Memory") }, select: { id: true } });
}

export async function readMemory(userId: string): Promise<{ id: string; note: string }[]> {
  const c = await memoryConvo(userId, false);
  if (!c) return [];
  const rows = await prisma.aIMessage.findMany({ where: { conversationId: c.id, role: "SYSTEM" }, orderBy: { createdAt: "asc" }, take: MAX_NOTES, select: { id: true, content: true } });
  return rows.map((r) => ({ id: r.id, note: decryptChat(userId, r.content) }));
}

export async function addMemory(userId: string, note: string): Promise<"saved" | "full"> {
  const c = (await memoryConvo(userId, true))!;
  const count = await prisma.aIMessage.count({ where: { conversationId: c.id, role: "SYSTEM" } });
  if (count >= MAX_NOTES) return "full";
  await prisma.aIMessage.create({ data: { conversationId: c.id, role: "SYSTEM", content: encryptChat(userId, note.slice(0, MAX_NOTE)) } });
  return "saved";
}

export async function clearMemory(userId: string): Promise<number> {
  const c = await memoryConvo(userId, false);
  if (!c) return 0;
  return (await prisma.aIMessage.deleteMany({ where: { conversationId: c.id } })).count;
}

export type MemoryCommand = { kind: "remember"; note: string } | { kind: "forget" } | { kind: "show" };

/** Recognises plain-language memory requests. Anything else goes to the model as usual. */
export function parseMemoryCommand(message: string): MemoryCommand | null {
  const m = message.trim();
  if (/^(please\s+)?(forget|clear|delete)\s+(everything|all|my memory|what you remember)\b/i.test(m)) return { kind: "forget" };
  if (/^(what|show|list)\b.{0,30}\b(remember|memory|memories)\b/i.test(m) && m.length < 80) return { kind: "show" };
  const r = /^(?:please\s+)?remember\s+(?:that\s+)?(.{3,})$/is.exec(m);
  if (r) return { kind: "remember", note: r[1].trim() };
  return null;
}

export function memoryPrompt(notes: { note: string }[]): string {
  if (!notes.length) return "";
  return `\nThings this user asked you to remember (use them naturally, never recite them unprompted):\n${notes.map((n) => `- ${n.note}`).join("\n")}`;
}

/**
 * Learning notes written by the system after a quiz (not typed by the user): one note per topic, updated in place,
 * oldest learning note dropped when the memory is full. Prefixed so they never collide with notes the user asked for.
 */
export async function upsertLearningNote(userId: string, topic: string, note: string): Promise<void> {
  const c = (await memoryConvo(userId, true))!;
  const tag = `[learning:${topic.toLowerCase().slice(0, 40)}] `;
  const rows = await prisma.aIMessage.findMany({ where: { conversationId: c.id, role: "SYSTEM" }, orderBy: { createdAt: "asc" }, select: { id: true, content: true } });
  const mine = rows.map((r) => ({ id: r.id, text: decryptChat(userId, r.content) }));
  const same = mine.find((m) => m.text.startsWith(tag));
  const content = encryptChat(userId, (tag + note).slice(0, MAX_NOTE));
  if (same) { await prisma.aIMessage.update({ where: { id: same.id }, data: { content } }); return; }
  if (rows.length >= MAX_NOTES) {
    const oldest = mine.find((m) => m.text.startsWith("[learning:"));
    if (!oldest) return;
    await prisma.aIMessage.delete({ where: { id: oldest.id } });
  }
  await prisma.aIMessage.create({ data: { conversationId: c.id, role: "SYSTEM", content } });
}
