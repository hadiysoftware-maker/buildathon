"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { usePermissions } from "@/providers/permissions-provider";
import { filterSidebarGroups, getBottomDockItems, getSidebarGroups } from "@/lib/nav-config";

interface MobileBottomNavProps {
  userRole: string;
  isModuleAllowed?: (mod: string) => boolean;
}

/**
 * Floating mobile pill dock matching `X:\fest-ms` `.ds-dock-wrap` -> `.ds-dock` + `.ds-dock-more`
 * with expandable subsection menus inside the "All pages" drawer.
 */
export function MobileBottomNav({ userRole, isModuleAllowed }: MobileBottomNavProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentSearch = searchParams?.toString() || "";
  const { allowedModules } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const checkAllowed = useMemo(
    () => isModuleAllowed ?? ((mod: string) => allowedModules.includes(mod)),
    [isModuleAllowed, allowedModules]
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, currentSearch]);

  const dockItems = useMemo(
    () => getBottomDockItems(userRole, checkAllowed),
    [userRole, checkAllowed]
  );

  const allGroups = useMemo(() => {
    const raw = getSidebarGroups(userRole);
    return filterSidebarGroups(raw, (mod) => !mod || checkAllowed(mod));
  }, [userRole, checkAllowed]);

  const isRouteActive = (href: string) => {
    const [base, query] = href.split("?");
    if (query) {
      if (pathname !== base) return false;
      const target = new URLSearchParams(query);
      const active = new URLSearchParams(currentSearch);
      let ok = true;
      target.forEach((v, k) => {
        if (active.get(k) !== v) ok = false;
      });
      return ok;
    }
    if (href.split("/").length === 2) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="ds-dock-wrap">
      {moreOpen && (
        <>
          <div className="ds-dock-scrim" onClick={() => setMoreOpen(false)} />
          <div className="ds-menu ds-dock-more" role="dialog" aria-label="All navigation">
            <div className="ds-sheet-grip" />
            {allGroups.map((group) => (
              <div key={group.label}>
                <div className="ds-menu-group">{group.label}</div>
                {group.items.map((item) => {
                  const hasKids = !!(item.children && item.children.length > 0);
                  const activeSelf = isRouteActive(item.href);
                  const activeChild = hasKids && item.children!.some((c) => isRouteActive(c.href));
                  const rowActive = activeSelf || activeChild;
                  const rowKey = `${group.label}:${item.title}`;
                  const isOpen = expanded === rowKey || (expanded === null && rowActive);

                  if (!hasKids) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className="ds-menu-item"
                        aria-current={activeSelf ? "page" : undefined}
                      >
                        <span>
                          <Icon name={item.icon} size={17} />
                        </span>
                        <span className="ds-label">{item.title}</span>
                      </Link>
                    );
                  }

                  return (
                    <div key={rowKey}>
                      <div className="ds-dock-row" data-active={rowActive ? "true" : undefined}>
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className="ds-menu-item"
                          aria-current={activeSelf ? "page" : undefined}
                        >
                          <span>
                            <Icon name={item.icon} size={17} />
                          </span>
                          <span className="ds-label">{item.title}</span>
                        </Link>
                        <button
                          type="button"
                          className="ds-dock-toggle"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? `Collapse ${item.title}` : `Expand ${item.title}`}
                          onClick={() => setExpanded(isOpen ? "" : rowKey)}
                        >
                          <span className={`ds-chev${isOpen ? " open" : ""}`}>
                            <Icon name="down" size={14} />
                          </span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="ds-dock-kids">
                          {item.children!.map((sub) => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => setMoreOpen(false)}
                              aria-current={isRouteActive(sub.href) ? "page" : undefined}
                            >
                              {sub.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      <nav className="ds-dock" aria-label="Primary dock">
        {dockItems.map((item) => {
          const active = isRouteActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="ds-dock-btn"
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} size={20} />
            </Link>
          );
        })}

        <button
          type="button"
          className="ds-dock-btn"
          aria-expanded={moreOpen}
          aria-label="More pages"
          title="More pages"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon name={moreOpen ? "close" : "menu"} size={20} />
        </button>
      </nav>
    </div>
  );
}
