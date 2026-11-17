"use client";

export type FontSize = "small" | "medium" | "large";

import { canStorePreferences } from "./consent";

const FONT_KEY = "c35_font_size";

export function getStoredFontSize(): FontSize {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch {
    /* storage unavailable */
  }
  return "medium";
}

export function applyTextSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fontSize = size;
  try {
    if (canStorePreferences()) localStorage.setItem(FONT_KEY, size);
  } catch {
    /* storage unavailable */
  }
}
