import "server-only";
import { prisma } from "@/lib/db";

/** Fan out an in-app notification to several users of one institution. Never throws: a failed notice must not fail the action. */
export async function notify(institutionId: string, userIds: string[], n: { type: string; title: string; body?: string; link?: string }) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({ data: ids.map((userId) => ({ institutionId, userId, type: n.type, title: n.title.slice(0, 200), body: n.body?.slice(0, 1000), link: n.link })) });
  } catch (e) {
    console.error("notify failed", e);
  }
}
