"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { ResponsiveTables } from "./ResponsiveTables";
import { CommandPalette } from "./CommandPalette";
import { CopilotDrawer } from "./CopilotDrawer";
import { AccountDialog } from "./AccountDialog";
import { PermissionsProvider, type ShellUser } from "@/providers/permissions-provider";
import { Icon } from "@/components/ui/Icon";
import { getPageTitle } from "@/lib/nav-config";

const CP_KEY = "c35_copilot";
const cpSubscribe = (cb: () => void) => {
  window.addEventListener("c35-copilot", cb);
  return () => window.removeEventListener("c35-copilot", cb);
};
/** "open" | "closed" | null (null = default: docked open on wide screens, hidden on small ones). */
const cpPref = () => { try { return localStorage.getItem(CP_KEY); } catch { return null; } };

function PanelCrumbs({ pathname, homeHref }: { pathname: string; homeHref: string }) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;
  const crumbs: { label: string; href: string }[] = [];
  let acc = "";
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const opaque = idx === segments.length - 1 && /^[a-z0-9]{20,}$/i.test(seg);
    const label = opaque
      ? "Details"
      : seg
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
    crumbs.push({ label, href: acc });
  });
  return (
    <nav className="ds-crumbs" aria-label="Breadcrumb">
      <Link href={homeHref} aria-label="Home">
        <Icon name="home" size={14} />
      </Link>
      {crumbs.map((c, idx) => (
        <span key={c.href} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="next" size={13} />
          {idx === crumbs.length - 1 ? <strong>{c.label}</strong> : <Link href={c.href}>{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

/**
 * Workspace shell: `.ds-app` → `.ds-topbar` + `.ds-body` → `.ds-side` + `.ds-panel` → `.ds-main`.
 * `allowedModules` only shapes the navigation; every server action re-checks permissions.
 */
export function DashboardShell({
  children,
  user,
  allowedModules,
  homeHref,
}: {
  children: React.ReactNode;
  user: ShellUser;
  allowedModules: string[];
  homeHref: string;
}) {
  const pathname = usePathname() || "";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pref = useSyncExternalStore(cpSubscribe, cpPref, () => null);
  const copilotOpen = pref === "open" ? true : pref === "closed" ? false : undefined;
  const setCopilot = (open: boolean) => {
    try { localStorage.setItem(CP_KEY, open ? "open" : "closed"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("c35-copilot"));
  };
  const toggleCopilot = () => {
    const wide = window.matchMedia("(min-width: 1200px)").matches;
    setCopilot(!(copilotOpen ?? wide));
  };
  const hasCopilot = allowedModules.includes("ai.use");
  const pageName = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    document.body.classList.add("ds-theme");
    return () => document.body.classList.remove("ds-theme");
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <PermissionsProvider user={user} allowedModules={allowedModules}>
      <div className="ds-app">
        <Header
          user={user}
          homeHref={homeHref}
          pageName={pageName}
          onMenuClick={() => setDrawerOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onOpenAccount={() => setAccountOpen(true)}
          onToggleCopilot={hasCopilot ? toggleCopilot : undefined}
          copilotOpen={copilotOpen ?? undefined}
        />
        <div className="ds-body">
          <Sidebar user={user} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <div className="ds-panel">
            <PanelCrumbs pathname={pathname} homeHref={homeHref} />
            <main key={pathname} className="ds-main animate-page-in print:p-0">
              {children}
            </main>
          </div>
          {hasCopilot && <CopilotDrawer open={copilotOpen} onClose={() => setCopilot(false)} role={user.role} />}
        </div>
        <MobileBottomNav userRole={user.role} />
        <ResponsiveTables />
        <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} userRole={user.role} />
        <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} user={user} />
      </div>
    </PermissionsProvider>
  );
}
