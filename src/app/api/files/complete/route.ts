import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { AREAS, bucketName, deleteObject, headObject, storageConfigured, type Area } from "@/lib/storage/r2";

const Body = z.object({
  area: z.enum(["avatar", "material"]),
  key: z.string().min(20).max(300),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(120),
});

/** Step 2: confirm the object really exists in R2 with an allowed size, then record its metadata. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requireSession();
    if (!storageConfigured()) return NextResponse.json({ error: "File storage is not configured yet." }, { status: 503 });
    const b = Body.parse(await req.json());
    const area = b.area as Area;
    const rule = AREAS[area];

    // Only keys this server issued for this tenant and area are accepted.
    if (!b.key.startsWith(`${s.institutionId}/${rule.prefix}/`) || b.key.includes("..")) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
    if (!(rule.mime as readonly string[]).includes(b.mimeType)) return NextResponse.json({ error: "This file type is not allowed here." }, { status: 400 });

    const head = await headObject(b.key);
    if (!head) return NextResponse.json({ error: "The upload did not arrive. Please try again." }, { status: 400 });
    if (head.size <= 0 || head.size > rule.maxBytes) {
      await deleteObject(b.key).catch(() => {});
      return NextResponse.json({ error: "File size is not allowed." }, { status: 400 });
    }

    const file = await prisma.fileObject.create({
      data: { institutionId: s.institutionId, bucket: bucketName(), objectKey: b.key, fileName: b.fileName, mimeType: b.mimeType, sizeBytes: BigInt(head.size), uploadedById: s.userId },
    });

    if (area === "avatar") {
      const old = await prisma.user.findUnique({ where: { id: s.userId }, select: { photoKey: true } });
      await prisma.user.update({ where: { id: s.userId }, data: { photoKey: file.id } });
      if (old?.photoKey) {
        const prev = await prisma.fileObject.findFirst({ where: { id: old.photoKey, institutionId: s.institutionId } });
        if (prev) {
          await prisma.fileObject.update({ where: { id: prev.id }, data: { deletedAt: new Date() } });
          await deleteObject(prev.objectKey).catch(() => {});
        }
      }
    }
    return NextResponse.json({ ok: true, fileId: file.id });
  });
}
