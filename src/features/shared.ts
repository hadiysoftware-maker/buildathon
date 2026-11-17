import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthError, requirePermission } from "@/lib/auth/guards";
import type { CurrentSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/permissions";
import type { ActionResult } from "./types";

/** Wrap a Server Action: authorize first, convert known failures into `{ ok:false, error }`. */
export async function action<T = undefined>(
  perm: PermissionKey,
  fn: (s: CurrentSession) => Promise<T>,
  revalidate: string[] = [],
): Promise<ActionResult<T>> {
  try {
    const s = await requirePermission(perm);
    const data = await fn(s);
    for (const p of revalidate) revalidatePath(p);
    return (data === undefined ? { ok: true } : { ok: true, data }) as ActionResult<T>;
  } catch (e) {
    return { ok: false, error: toMessage(e) };
  }
}

export class UserError extends Error {}

function toMessage(e: unknown): string {
  if (e instanceof AuthError) return e.status === 401 ? "Please sign in again." : "You do not have permission to do that.";
  if (e instanceof UserError) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Invalid input";
  const code = (e as { code?: string })?.code;
  if (code === "P2002") return "A record with these details already exists.";
  if (code === "P2003") return "This record is linked to other data and cannot be changed that way.";
  if (code === "P2025") return "Record not found.";
  console.error(e);
  return "Something went wrong. Please try again.";
}
