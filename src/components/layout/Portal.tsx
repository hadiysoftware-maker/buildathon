import { DashboardShell } from "./Shell";
import { requireRolePage } from "@/lib/auth/guards";
import { ROLE_PERMISSIONS, type RoleKey } from "@/lib/permissions";

/** Server wrapper used by each role's layout: authenticates, then renders the workspace shell. */
export async function Portal({
  roles,
  loginPath,
  homeHref,
  children,
}: {
  roles: RoleKey[];
  loginPath: string;
  homeHref: string;
  children: React.ReactNode;
}) {
  const s = await requireRolePage(roles, loginPath);
  return (
    <DashboardShell
      user={{ id: s.user.id, fullName: s.user.fullName, email: s.user.email, role: s.role, photoId: s.user.photoKey }}
      allowedModules={ROLE_PERMISSIONS[s.role]}
      homeHref={homeHref}
    >
      {children}
    </DashboardShell>
  );
}
