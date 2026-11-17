import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession, type CurrentSession } from "./session";
import { hasPermission, type PermissionKey, type RoleKey } from "@/lib/permissions";

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

export async function requireSession(): Promise<CurrentSession> {
  const s = await getSession();
  if (!s) throw new AuthError(401, "Not authenticated");
  return s;
}

export async function requirePermission(perm: PermissionKey): Promise<CurrentSession> {
  const s = await requireSession();
  if (!hasPermission(s.role, perm)) throw new AuthError(403, "Forbidden");
  return s;
}

/** For server components/pages: redirect instead of throwing. */
export async function requireRolePage(roles: RoleKey[], loginPath: string): Promise<CurrentSession> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) redirect(loginPath);
  return s;
}

/**
 * Pages MUST call this (or requireRolePage) themselves: layouts are not re-rendered on client
 * navigation, so a layout-only check is not an authorization boundary.
 */
export async function requirePagePermission(perm: PermissionKey, loginPath = "/admin/login"): Promise<CurrentSession> {
  const s = await getSession();
  if (!s) redirect(loginPath);
  if (!hasPermission(s.role, perm)) notFound();
  return s;
}
