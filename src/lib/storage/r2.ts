import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

/**
 * Cloudflare R2 (S3-compatible). Files never pass through this server: the browser uploads straight to R2 with a
 * short-lived presigned PUT, and downloads go through a short-lived presigned GET issued after an access check.
 * The bucket stays private; MySQL (`FileObject`) keeps only the key and metadata.
 */

export class StorageNotConfigured extends Error {
  constructor() {
    super("File storage is not configured yet. Ask an administrator to set the R2 environment variables.");
  }
}

export function storageConfigured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!storageConfigured()) throw new StorageNotConfigured();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}
export const bucketName = () => process.env.R2_BUCKET ?? "";

/** Upload "areas": what may be uploaded, how big, and under which key prefix. */
export const AREAS = {
  avatar: { prefix: "avatars", maxBytes: 2 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp"] },
  // Files attached in Copilot chat. Private to the uploader (see storage/access.ts); read by the AI only for that user's own chat.
  chat: { prefix: "chat", maxBytes: 8 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv"] },
  // Assignment attachments (teachers) and submissions (students).
  work: { prefix: "work", maxBytes: 15 * 1024 * 1024, mime: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  material: {
    prefix: "materials",
    maxBytes: 25 * 1024 * 1024,
    mime: [
      "application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
} as const;
export type Area = keyof typeof AREAS;

/** Reads a stored object (server side only), for the copilot to review attachments. */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  return (await r.Body?.transformToByteArray()) ?? new Uint8Array();
}

/** Keys are generated server-side: tenant/area/random. The user's file name is metadata only, never part of the key. */
export function newObjectKey(institutionId: string, area: Area): string {
  return `${institutionId}/${AREAS[area].prefix}/${randomBytes(16).toString("hex")}`;
}

export async function presignUpload(key: string, mime: string, size: number) {
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: mime, ContentLength: size }), { expiresIn: 300 });
  return url;
}

export async function presignDownload(key: string, fileName: string, inline: boolean) {
  const safe = fileName.replace(/[^\w.\- ]/g, "_").slice(0, 120);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucketName(), Key: key, ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename="${safe}"` }),
    { expiresIn: 120 },
  );
}

export async function headObject(key: string): Promise<{ size: number; type?: string } | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
    return { size: Number(r.ContentLength ?? 0), type: r.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}

/** Server-side upload for files the platform itself generates (Copilot documents). */
export async function putObjectBytes(key: string, bytes: Uint8Array, mime: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: bytes, ContentType: mime }));
}
