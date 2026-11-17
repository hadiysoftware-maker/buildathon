"use client";

import { createContext, useContext, useMemo } from "react";

export interface ShellUser {
  id: string;
  fullName: string;
  email: string | null;
  role: string;
  /** FileObject id of the profile photo, if any. */
  photoId?: string | null;
}

interface PermissionsContextValue {
  user: ShellUser | null;
  /** Permission keys granted to the user's role. Used for UI only; the server re-checks every request. */
  allowedModules: string[];
  can: (perm?: string) => boolean;
}

const Ctx = createContext<PermissionsContextValue>({ user: null, allowedModules: [], can: () => false });

export function PermissionsProvider({
  user,
  allowedModules,
  children,
}: {
  user: ShellUser | null;
  allowedModules?: string[];
  children: React.ReactNode;
}) {
  const value = useMemo<PermissionsContextValue>(() => {
    const mods = allowedModules ?? [];
    return { user, allowedModules: mods, can: (p) => !p || mods.includes(p) };
  }, [user, allowedModules]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePermissions = () => useContext(Ctx);
