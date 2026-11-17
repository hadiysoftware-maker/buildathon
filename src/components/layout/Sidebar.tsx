"use client";

import { useCallback, useEffect, useMemo, useState, useId } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { usePermissions } from "@/providers/permissions-provider";
import { filterSidebarGroups, getSidebarGroups, type NavItem } from "@/lib/nav-config";

interface SidebarProps {
  user: any;
  allowedModules?: string[];
  isOpen?: boolean;
  onClose?: () => void;
}

function matchHref(href: string, pathname: string, currentSearch: string): boolean {
  const [base, query] = href.split("?");
  if (query) {
    if (pathname !== base) return false;
    const target = new URLSearchParams(query);
    const active = new URLSearchParams(currentSearch);
    let allMatch = true;
    target.forEach((v, k) => {
      if (active.get(k) !== v) allMatch = false;
    });
    return allMatch;
  }
  if (href.split("/").length === 2) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemOrChildActive(item: NavItem, pathname: string, currentSearch: string): boolean {
  if (matchHref(item.href, pathname, currentSearch)) return true;
  if (item.children?.some((c) => matchHref(c.href, pathname, currentSearch))) return true;
  return false;
}

function SideItem({
  item,
  pathname,
  currentSearch,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  currentSearch: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const panelId = useId();
  const kids = item.children || [];
  const hasKids = kids.length > 0;
  const selfActive = matchHref(item.href, pathname, currentSearch);
  const childActive = hasKids && kids.some((c) => matchHref(c.href, pathname, currentSearch));
  const parentActive = selfActive || childActive;

  if (!hasKids) {
    return (
      <Link
        href={item.href}
        prefetch={false}
        onClick={onNavigate}
        className="ds-side-link"
        aria-current={selfActive ? "page" : undefined}
      >
        <span>
          <Icon name={item.icon} size={17} />
        </span>
        <span className="ds-label">{item.title}</span>
      </Link>
    );
  }

  return (
    <div>
      <div className="ds-side-row" data-parent={parentActive ? "true" : undefined}>
        <Link
          href={item.href}
          prefetch={false}
          onClick={onNavigate}
          className="ds-side-link"
          data-parent={childActive && !selfActive ? "true" : undefined}
          aria-current={selfActive ? "page" : undefined}
        >
          <span>
            <Icon name={item.icon} size={17} />
          </span>
          <span className="ds-label">{item.title}</span>
        </Link>
        <button
          type="button"
          className="ds-side-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Collapse ${item.title}` : `Expand ${item.title}`}
          onClick={onToggle}
        >
          <span className={`ds-chev${open ? " open" : ""}`}>
            <Icon name="down" size={14} />
          </span>
        </button>
      </div>
      <div id={panelId} className="ds-side-collapse" data-open={open ? "true" : "false"}>
        <div className="ds-side-children">
          {kids.map((c) => {
            const isChildCurrent = matchHref(c.href, pathname, currentSearch);
            return (
              <Link
                key={c.href}
                href={c.href}
                prefetch={false}
                onClick={onNavigate}
                className="ds-side-child"
                aria-current={isChildCurrent ? "page" : undefined}
              >
                {c.title}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Single-bar fest-ms style sidebar (`.ds-side`) with parent routes + collapsible subsections.
 */
export function Sidebar({ user, allowedModules: propModules, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentSearch = searchParams?.toString() || "";
  const { allowedModules: ctxModules } = usePermissions();
  const resolvedModules = propModules ?? ctxModules ?? [];
  const checkAllowed = useCallback(
    (mod?: string) => !mod || resolvedModules.includes(mod),
    [resolvedModules]
  );
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({});

  const userRole = useMemo(
    () => (typeof user?.role === "string" ? user.role : user?.role?.name || "UNASSIGNED"),
    [user]
  );


  const groups = useMemo(() => {
    const raw = getSidebarGroups(userRole);
    return filterSidebarGroups(raw, checkAllowed);
  }, [userRole, checkAllowed]);

  const activeParentKeys = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      for (const item of g.items) {
        if (item.children?.length && itemOrChildActive(item, pathname, currentSearch)) {
          set.add(`${g.label}:${item.title}`);
        }
      }
    }
    return set;
  }, [groups, pathname, currentSearch]);

  // Reset manual overrides when navigating to a new route so the active subsection opens cleanly
  useEffect(() => {
    setUserToggled({});
  }, [pathname, currentSearch]);

  const toggleItem = useCallback((key: string, currentOpen: boolean) => {
    setUserToggled((prev) => ({ ...prev, [key]: !currentOpen }));
  }, []);

  const renderTree = (onNavigate?: () => void) => (
    <>
      {groups.map((group) => (
        <div key={group.label}>
          {groups.length > 1 && <div className="ds-side-group">{group.label}</div>}
          {group.items.map((item) => {
            const key = `${group.label}:${item.title}`;
            const defaultOpen = activeParentKeys.has(key);
            const open = key in userToggled ? userToggled[key] : defaultOpen;
            return (
              <SideItem
                key={key}
                item={item}
                pathname={pathname}
                currentSearch={currentSearch}
                open={open}
                onToggle={() => toggleItem(key, open)}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop single sidebar bar (fest-ms `.ds-side`) */}
      <aside className="ds-side" aria-label="Workspace navigation">
        {renderTree()}
      </aside>

      {/* Mobile Drawer fallback (EXAMINER or Header menu button) */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full bg-[var(--md-bg)] border-r border-[var(--md-outline-variant)] p-3 overflow-y-auto flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-2 border-b border-[var(--md-outline-variant)] mb-2">
              <span className="font-heading font-bold text-sm text-[var(--md-on-surface)]">
                Navigation
              </span>
              <button type="button" onClick={onClose} className="ds-icon-btn w-8 h-8" aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            {renderTree(onClose)}
          </aside>
        </div>
      )}
    </>
  );
}
