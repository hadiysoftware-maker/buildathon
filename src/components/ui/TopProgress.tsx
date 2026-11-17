"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgress() {
  const pathname = usePathname() || "";
  const search = useSearchParams()?.toString() || "";
  const [state, setState] = useState<"idle" | "run" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (state !== "run") return;
    setState("done");
    timer.current = setTimeout(() => setState("idle"), 260);
    return () => clearTimeout(timer.current);
  }, [pathname, search, state]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href === `${pathname}${search ? `?${search}` : ""}`) return;
      clearTimeout(timer.current);
      setState("run");
      timer.current = setTimeout(() => setState("idle"), 8000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, search]);

  return (
    <div className="top-progress" data-state={state} aria-hidden="true">
      <i />
    </div>
  );
}
