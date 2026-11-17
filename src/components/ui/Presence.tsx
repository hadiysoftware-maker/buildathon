"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type MotionVariant = "fade" | "pop" | "menu" | "dialog" | "collapse";

const EXIT_MS: Record<MotionVariant, number> = {
  fade: 160,
  pop: 160,
  menu: 160,
  dialog: 210,
  collapse: 220,
};

/**
 * Keeps `children` mounted through both the opening transition frame and the closing animation
 * so every modal/dialog/popover opens and closes smoothly without framer-motion.
 */
export function Presence({
  show,
  variant = "fade",
  className,
  style,
  children,
}: {
  show: boolean;
  variant?: MotionVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(show);
  const [state, setState] = useState<"open" | "closing">("closing");

  useEffect(() => {
    if (show) {
      setMounted(true);
      setState("closing");
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setState("open"));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    if (!mounted) return;
    setState("closing");
    const t = setTimeout(() => setMounted(false), EXIT_MS[variant]);
    return () => clearTimeout(t);
  }, [show, mounted, variant]);

  if (!mounted) return null;

  return (
    <div
      className={`presence-${variant}${className ? ` ${className}` : ""}`}
      data-state={state}
      style={style}
    >
      {children}
    </div>
  );
}

/** Holds the last non-null value while closing so content stays visible during exit. */
export function useLatest<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value !== null) ref.current = value;
  return value ?? ref.current;
}

