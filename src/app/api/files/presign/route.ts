import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { requireSession } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { AREAS, newObjectKey, presignUpload, storageConfigured, type Area } from "@/lib/storage/r2";

const Body = z.object({
  area: z.enum(["avatar", "material"]),
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().positive(),
});

/** Step 1 of an upload: validate type and size for the area, then hand back a short-lived presigned PUT URL. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requireSession();
    if (!storageConfigured()) return NextResponse.json({ error: "File storage is not configured yet." }, { status: 503 });
    if (!(await rateLimit(`upload:${s.userId}`, 30, 60_000))) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });

    const b = Body.parse(await req.json());
    const area = b.area as Area;
    if (area === "material" && s.role !== "TEACHER" && s.role !== "ADMIN" && s.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "You cannot upload study material." }, { status: 403 });
    }
    const rule = AREAS[area];
    if (!(rule.mime as readonly string[]).includes(b.mimeType)) return NextResponse.json({ error: "This file type is not allowed here." }, { status: 400 });
    if (b.sizeBytes > rule.maxBytes) return NextResponse.json({ error: `File is too large (limit ${Math.round(rule.maxBytes / 1024 / 1024)} MB).` }, { status: 400 });

    const key = newObjectKey(s.institutionId, area);
    const uploadUrl = await presignUpload(key, b.mimeType, b.sizeBytes);
    return NextResponse.json({ key, uploadUrl });
  });
}
