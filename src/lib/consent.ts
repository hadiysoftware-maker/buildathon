"use client";

/**
 * Cookie and storage consent.
 * - essential: sign-in session and security cookies. Always on, needed for the site to work.
 * - preferences: remembers your theme (light or dark) and text size on this device.
 * The app uses no advertising or analytics cookies, so there is nothing else to ask for.
 */
export interface Consent { v: 1; essential: true; preferences: boolean; at: string }

const COOKIE = "c35_consent";
const OPEN_EVENT = "c35:consent-open";
const CHANGE_EVENT = "c35:consent-change";
const PREF_KEYS = ["c35_theme", "c35_font_size"];

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!m) return null;
  try {
    const j = JSON.parse(decodeURIComponent(m.slice(COOKIE.length + 1))) as Consent;
    return j?.v === 1 ? j : null;
  } catch {
    return null;
  }
}

/** True when the user allowed remembering preferences. Without a choice yet, nothing is stored. */
export const canStorePreferences = () => readConsent()?.preferences === true;

export function saveConsent(preferences: boolean) {
  const value: Consent = { v: 1, essential: true, preferences, at: new Date().toISOString() };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
  if (!preferences) {
    try { PREF_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
  } else {
    try {
      localStorage.setItem("c35_theme", document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      const f = document.documentElement.dataset.fontSize;
      if (f) localStorage.setItem("c35_font_size", f);
    } catch { /* storage unavailable */ }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Opens the consent panel again (used by the "Cookie settings" links). */
export const openConsent = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const CONSENT_OPEN_EVENT = OPEN_EVENT;
export const CONSENT_CHANGE_EVENT = CHANGE_EVENT;
