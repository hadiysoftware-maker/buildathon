import "server-only";
import { prisma } from "@/lib/db";
import type { CurrentSession } from "@/lib/auth/session";
import { newObjectKey, putObjectBytes, storageConfigured } from "@/lib/storage/r2";

export const MIME = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

const safeName = (t: string, ext: string) => `${t.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document"}.${ext}`;

/** Stores a generated file privately for the user (chat area: readable only by the person who asked for it). */
export async function saveGenerated(s: CurrentSession, title: string, kind: keyof typeof MIME, bytes: Buffer): Promise<{ fileId: string; name: string; size: number }> {
  if (!storageConfigured()) throw new Error("File storage is not configured.");
  if (bytes.length > 20 * 1024 * 1024) throw new Error("The generated file is too large.");
  const key = newObjectKey(s.institutionId, "chat");
  await putObjectBytes(key, bytes, MIME[kind]);
  const name = safeName(title, kind);
  const f = await prisma.fileObject.create({
    data: { institutionId: s.institutionId, bucket: process.env.R2_BUCKET ?? "", objectKey: key, fileName: name, mimeType: MIME[kind], sizeBytes: BigInt(bytes.length), uploadedById: s.userId },
  });
  return { fileId: f.id, name, size: bytes.length };
}
