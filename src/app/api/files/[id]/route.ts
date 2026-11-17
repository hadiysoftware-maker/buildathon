import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { canReadFile } from "@/lib/storage/access";
import { presignDownload, storageConfigured } from "@/lib/storage/r2";

/** Access-checked download: redirects to a 2-minute presigned R2 URL. The bucket itself is never public. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    if (!storageConfigured()) return NextResponse.json({ error: "File storage is not configured yet." }, { status: 503 });
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({ where: { id, deletedAt: null } });
    // Same response for "missing" and "not yours" so ids cannot be probed.
    if (!file || !(await canReadFile(s, file))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const download = new URL(req.url).searchParams.get("dl") === "1";
    const inline = !download && /^(image\/|application\/pdf|video\/)/.test(file.mimeType);
    const url = await presignDownload(file.objectKey, file.fileName, inline);
    return NextResponse.redirect(url, 302);
  });
}
