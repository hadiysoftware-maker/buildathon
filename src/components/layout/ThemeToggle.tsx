"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { canStorePreferences } from "@/lib/consent";

const KEY = "c35_theme";

/** Light / dark switch. First visit follows the system setting; after a click the choice is remembered. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark"); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { if (canStorePreferences()) localStorage.setItem(KEY, next ? "dark" : "light"); } catch { /* private mode */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#0B1514" : "#EBF4F2");
  };
  return (
    <button type="button" className="ds-icon-btn" onClick={flip} aria-pressed={dark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      <Icon name={dark ? "sun" : "moon"} size={19} />
    </button>
  );
}
