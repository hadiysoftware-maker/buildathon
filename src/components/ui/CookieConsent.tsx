"use client";

import { useEffect, useRef, useState } from "react";
import { CONSENT_OPEN_EVENT, readConsent, saveConsent } from "@/lib/consent";
import "./cookie-consent.css";

/** Bottom banner on the first visit, and a settings panel that can be reopened any time. */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const c = readConsent();
    if (!c) setOpen(true); // eslint-disable-line react-hooks/set-state-in-effect
    else setPrefs(c.preferences);
    const reopen = () => { setPrefs(readConsent()?.preferences ?? false); setDetails(true); setOpen(true); };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (open) first.current?.focus();
  }, [open, details]);

  if (!open) return null;
  const done = (p: boolean) => { saveConsent(p); setOpen(false); setDetails(false); };

  return (
    <div className="cc-banner" role="dialog" aria-modal="false" aria-labelledby="cc-title" aria-describedby="cc-desc" onKeyDown={(e) => { if (e.key === "Escape" && readConsent()) setOpen(false); }}>
      <div className="cc-text">
        <strong id="cc-title">Cookies on EduCore</strong>
        <p id="cc-desc">
          We use essential cookies to keep you signed in and secure. With your OK we also remember your theme and text size on this device. We do not use advertising or tracking cookies.
        </p>
        {details && (
          <ul className="cc-list">
            <li>
              <label><input type="checkbox" checked disabled /> <b>Essential</b></label>
              <small>Sign-in session, security checks and this choice. Always on.</small>
            </li>
            <li>
              <label><input type="checkbox" checked={prefs} onChange={(e) => setPrefs(e.target.checked)} /> <b>Preferences</b></label>
              <small>Remembers light or dark mode and your text size.</small>
            </li>
          </ul>
        )}
      </div>
      <div className="cc-actions">
        {details ? (
          <button type="button" ref={first} className="cc-primary" onClick={() => done(prefs)}>Save choices</button>
        ) : (
          <>
            <button type="button" ref={first} className="cc-primary" onClick={() => done(true)}>Accept all</button>
            <button type="button" className="cc-secondary" onClick={() => done(false)}>Essential only</button>
            <button type="button" className="cc-link" onClick={() => setDetails(true)}>Customise</button>
          </>
        )}
      </div>
    </div>
  );
}
