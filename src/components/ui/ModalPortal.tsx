"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Safe client-side portal wrapper rendering overlays outside transformed parent panels.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

