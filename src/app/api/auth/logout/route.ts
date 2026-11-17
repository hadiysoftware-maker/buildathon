import { NextResponse } from "next/server";
import { assertSameOrigin, handle } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await destroySession();
    return NextResponse.json({ ok: true });
  });
}
