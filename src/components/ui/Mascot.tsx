"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * "Nova", the Campus 2035 study buddy: a round little robot with a glowing face screen.
 * It watches the cursor and reacts to how close it gets:
 *   far → its resting mood · near → curious (eyes widen, follows you) · close → happy (smile, blush, glowing antenna)
 *   very close → delighted (happy eyes, hearts, bounce) · click/tap → surprised burst.
 * Props keep the old API (mood / pose / prop / size) so every page that shows the mascot keeps working.
 */

export type Mood = "happy" | "proud" | "celebrate" | "focus" | "thinking" | "wow" | "oops" | "sad" | "sleepy" | "sleep" | "rest" | "stern";
export type Pose = "wave" | "point" | "cheer" | "shrug" | "think" | "rest" | "stop" | "read" | "circle" | "card" | "inline" | "stand" | "confused" | "peek";
export type MascotProp = "none" | "book" | "cap" | "attendance" | "marks" | "wallet" | "bell" | "search" | "magnifying" | "lock" | "shield" | "medical" | "offline" | "trophy" | "calendar" | "pencil";

type Face = "calm" | "curious" | "happy" | "delighted" | "wow" | "sad" | "sleepy" | "stern" | "thinking" | "oops";

const BODY = "var(--mascot-khaki, #0F766E)";
const BODY_LIGHT = "var(--mascot-khaki-light, #E1F4F0)";
const BODY_MID = "var(--mascot-khaki-mid, #5EC4B6)";
const SCREEN = "#0B2F2C";
const GLOW = "#7DF3DF";
const ACCENT = "#F59E0B";
const INK = "var(--mascot-ink, #12272A)";

function baseFace(mood: Mood): Face {
  switch (mood) {
    case "happy": case "proud": case "celebrate": return "happy";
    case "wow": return "wow";
    case "sad": return "sad";
    case "oops": return "oops";
    case "sleepy": case "sleep": case "rest": return "sleepy";
    case "stern": return "stern";
    case "thinking": case "focus": return "thinking";
    default: return "calm";
  }
}

// One shared pointer listener for all mascots on the page.
type Pt = { x: number; y: number };
const subs = new Set<(p: Pt) => void>();
let last: Pt | null = null;
let bound = false;
function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  let raf = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      last = { x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (last) subs.forEach((f) => f(last!));
      });
    },
    { passive: true },
  );
  window.addEventListener("pointerleave", () => subs.forEach((f) => f({ x: -9999, y: -9999 })));
}

function Eyes({ face, px, py }: { face: Face; px: number; py: number }) {
  const L = 84, R = 136, Y = 92;
  const stroke = { stroke: GLOW, strokeWidth: 4.5, strokeLinecap: "round" as const, fill: "none" };
  switch (face) {
    case "delighted":
      return (<g {...stroke}><path d={`M${L - 9} ${Y + 3}q9 -13 18 0`} /><path d={`M${R - 9} ${Y + 3}q9 -13 18 0`} /></g>);
    case "sleepy":
      return (<g {...stroke}><path d={`M${L - 8} ${Y}h16`} /><path d={`M${R - 8} ${Y}h16`} /></g>);
    case "stern":
      return (<g {...stroke}><path d={`M${L - 9} ${Y - 7}l18 5`} /><path d={`M${R + 9} ${Y - 7}l-18 5`} /><circle cx={L} cy={Y + 3} r="4" fill={GLOW} /><circle cx={R} cy={Y + 3} r="4" fill={GLOW} /></g>);
    case "sad":
      return (<g><ellipse cx={L} cy={Y + 2} rx="7" ry="8" fill={GLOW} /><ellipse cx={R} cy={Y + 2} rx="7" ry="8" fill={GLOW} /><path d={`M${L - 10} ${Y - 9}l18 -4M${R + 10} ${Y - 9}l-18 -4`} {...stroke} strokeWidth={3} /></g>);
    case "oops":
      return (<g {...stroke} strokeWidth={4}><path d={`M${L - 7} ${Y - 6}l14 12M${L + 7} ${Y - 6}l-14 12`} /><path d={`M${R - 7} ${Y - 6}l14 12M${R + 7} ${Y - 6}l-14 12`} /></g>);
    case "thinking":
      return (<g><ellipse cx={L + px * 0.5} cy={Y} rx="7" ry="9" fill={GLOW} /><path d={`M${R - 9} ${Y + 1}h18`} {...stroke} /></g>);
    case "wow":
    case "curious": {
      const r = face === "wow" ? 11 : 9.5;
      return (
        <g>
          {[L, R].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={Y} r={r} fill={GLOW} />
              <circle cx={cx + px} cy={Y + py} r={r * 0.45} fill={SCREEN} />
              <circle cx={cx + px - 2} cy={Y + py - 2} r="1.8" fill="#fff" />
            </g>
          ))}
        </g>
      );
    }
    default: // calm, happy
      return (
        <g>
          {[L, R].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx + px * 0.5} cy={Y + py * 0.5} rx="7" ry={face === "happy" ? 9 : 8} fill={GLOW} />
              <circle cx={cx + px * 0.5 - 2} cy={Y + py * 0.5 - 3} r="1.8" fill="#fff" />
            </g>
          ))}
        </g>
      );
  }
}

function Mouth({ face }: { face: Face }) {
  const s = { stroke: GLOW, strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  switch (face) {
    case "delighted": return <path d="M98 112q12 17 24 0z" fill={GLOW} stroke={GLOW} strokeWidth="3" strokeLinejoin="round" />;
    case "happy": return <path d="M98 111q12 12 24 0" {...s} />;
    case "curious": return <ellipse cx="110" cy="113" rx="4" ry="5" fill={GLOW} />;
    case "wow": return <ellipse cx="110" cy="114" rx="6" ry="8" fill={GLOW} />;
    case "sad": return <path d="M99 117q11 -10 22 0" {...s} />;
    case "oops": return <path d="M98 114q4 -5 8 0t8 0t8 0" {...s} strokeWidth={3} />;
    case "sleepy": return <path d="M104 113h12" {...s} strokeWidth={3} />;
    case "stern": return <path d="M99 114h22" {...s} />;
    case "thinking": return <path d="M104 113q8 3 16 -2" {...s} strokeWidth={3} />;
    default: return <path d="M100 112q10 7 20 0" {...s} strokeWidth={3.5} />;
  }
}

function Arms({ pose, excited }: { pose: Pose; excited: boolean }) {
  const st = { stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, fill: BODY_MID };
  const up = pose === "cheer" || excited;
  const wave = pose === "wave" && !excited;
  return (
    <g>
      <path d={up ? "M62 156q-16 -4 -18 -26" : pose === "shrug" ? "M62 152q-14 -2 -16 -10" : "M62 150q-12 8 -14 24"} {...st} fill="none" strokeWidth="9" stroke={BODY_MID} />
      <path d={up ? "M62 156q-16 -4 -18 -26" : pose === "shrug" ? "M62 152q-14 -2 -16 -10" : "M62 150q-12 8 -14 24"} {...st} fill="none" strokeWidth="2" opacity="0" />
      <g className={wave ? "nv-wave" : undefined} style={{ transformOrigin: "158px 150px" }}>
        <path d={wave || up ? "M158 156q16 -4 18 -26" : pose === "point" ? "M158 150q22 -2 30 -12" : pose === "shrug" ? "M158 152q14 -2 16 -10" : "M158 150q12 8 14 24"} fill="none" strokeWidth="9" stroke={BODY_MID} strokeLinecap="round" />
      </g>
    </g>
  );
}

function Accessory({ prop }: { prop: MascotProp }) {
  const g = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (prop) {
    case "cap":
      return (<g {...g}><path d="M110 22L62 40l48 17 48-17z" fill={INK} /><path d="M84 47v10c9 5 43 5 52 0V47" fill={INK} /><path d="M152 42v20" /><circle cx="152" cy="64" r="3.5" fill={ACCENT} /></g>);
    case "book":
      return (<g {...g} transform="translate(150 158)"><path d="M0 0q14 -6 28 0v26q-14 -6 -28 0z" fill="#fff" /><path d="M14 -3v26" /></g>);
    case "bell":
      return (<g {...g} transform="translate(152 150)"><path d="M14 0a10 10 0 0 1 10 10v8l4 5H0l4-5v-8A10 10 0 0 1 14 0z" fill={ACCENT} /><circle cx="14" cy="28" r="3" fill={INK} /></g>);
    case "search":
    case "magnifying":
      return (<g {...g} transform="translate(152 150)"><circle cx="12" cy="12" r="10" fill="#fff" fillOpacity="0.85" /><path d="M20 20l12 12" strokeWidth="4" /></g>);
    case "lock":
      return (<g {...g} transform="translate(154 154)"><rect x="0" y="10" width="26" height="20" rx="4" fill={ACCENT} /><path d="M6 10V6a7 7 0 0 1 14 0v4" fill="none" /></g>);
    case "shield":
    case "medical":
      return (<g {...g} transform="translate(152 148)"><path d="M14 0l14 5v12c0 9-6 15-14 18C6 32 0 26 0 17V5z" fill="#fff" /><path d="M14 9v14M7 16h14" stroke={BODY} strokeWidth="3" /></g>);
    case "trophy":
      return (<g {...g} transform="translate(152 148)"><path d="M4 0h20v12a10 10 0 0 1-20 0z" fill={ACCENT} /><path d="M14 22v8M7 32h14" /></g>);
    case "calendar":
    case "attendance":
      return (<g {...g} transform="translate(150 150)"><rect x="0" y="4" width="30" height="26" rx="4" fill="#fff" /><path d="M0 12h30M9 0v8M21 0v8" /><circle cx="15" cy="21" r="3" fill={BODY} /></g>);
    case "pencil":
    case "marks":
      return (<g {...g} transform="translate(154 146) rotate(35)"><rect x="0" y="0" width="9" height="30" rx="2" fill={ACCENT} /><path d="M0 30l4.5 7L9 30z" fill="#fff" /></g>);
    case "wallet":
      return (<g {...g} transform="translate(150 158)"><rect x="0" y="0" width="30" height="22" rx="5" fill={ACCENT} /><circle cx="23" cy="11" r="3" fill="#fff" /></g>);
    case "offline":
      return (<g {...g} transform="translate(152 150)"><path d="M2 16a20 20 0 0 1 28 0M8 22a12 12 0 0 1 16 0" fill="none" /><path d="M0 34L32 2" stroke="#F3797E" strokeWidth="3" /></g>);
    default:
      return null;
  }
}

export function Mascot({
  mood = "happy",
  pose = "wave",
  prop = "none",
  size = 180,
  label,
  style,
  className = "",
  interactive = true,
}: {
  mood?: Mood;
  pose?: Pose;
  prop?: MascotProp;
  size?: number | "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
  style?: CSSProperties;
  className?: string;
  /** Turn off cursor reactions (e.g. for tiny decorative uses). */
  interactive?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState<{ px: number; py: number; level: 0 | 1 | 2 | 3 }>({ px: 0, py: 0, level: 0 });
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!interactive) return;
    bind();
    const f = (p: Pt) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      // thresholds scale with the mascot's own size so small and large mascots feel alike
      const u = dist / r.width;
      const level: 0 | 1 | 2 | 3 = u > 2.4 ? 0 : u > 1.3 ? 1 : u > 0.65 ? 2 : 3;
      const k = Math.min(1, dist / 160);
      const px = Math.round((dx / (dist || 1)) * 4.5 * k * 2) / 2;
      const py = Math.round((dy / (dist || 1)) * 3.5 * k * 2) / 2;
      setLook((o) => (o.px === px && o.py === py && o.level === level ? o : { px, py, level }));
    };
    subs.add(f);
    return () => { subs.delete(f); };
  }, [interactive]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(0), 1100);
    return () => clearTimeout(t);
  }, [burst]);

  const resolved = typeof size === "number" ? size : { xs: 64, sm: 96, md: 140, lg: 180, xl: 240 }[size];
  const rest = baseFace(mood);
  const face: Face = burst ? "wow" : look.level === 3 ? "delighted" : look.level === 2 ? "happy" : look.level === 1 ? "curious" : rest;
  const tracking = look.level > 0 || burst > 0;
  const px = tracking ? look.px : 0;
  const py = tracking ? look.py : 0;
  const glow = look.level >= 2 || face === "happy";
  const sleeping = face === "sleepy" && !tracking;
  const tilt = tracking ? Math.max(-10, Math.min(10, look.px * 2.2)) : 0;

  return (
    <svg
      ref={ref}
      suppressHydrationWarning
      width={resolved}
      height={resolved}
      viewBox="0 0 220 220"
      className={`mascot nova-mascot ${look.level === 3 ? "nv-bounce" : ""} ${className}`.trim()}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      style={{ flex: "none", overflow: "visible", cursor: interactive ? "pointer" : undefined, ...style }}
      onPointerDown={interactive ? () => setBurst((b) => b + 1) : undefined}
    >
      {/* ground shadow */}
      <ellipse cx="110" cy="203" rx="46" ry="7" fill={BODY_MID} opacity="0.55" />

      {/* legs + feet */}
      <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round" fill={BODY}>
        <rect x="84" y="186" width="18" height="12" rx="6" />
        <rect x="118" y="186" width="18" height="12" rx="6" />
      </g>

      <Arms pose={pose} excited={face === "delighted" || face === "wow"} />

      {/* body */}
      <g stroke={INK} strokeWidth="2.6" strokeLinejoin="round">
        <rect x="68" y="136" width="84" height="56" rx="26" fill={BODY} />
        <circle cx="110" cy="164" r="9" fill={BODY_LIGHT} />
      </g>
      <circle cx="110" cy="164" r="4" fill={glow ? ACCENT : BODY_MID} style={{ transition: "fill .25s" }} />

      {/* head (tilts toward the cursor) */}
      <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "110px 140px", transition: "transform .25s ease-out" }}>
        {/* antenna */}
        <path d="M110 48V30" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="110" cy="25" r="7" fill={glow ? ACCENT : BODY_LIGHT} stroke={INK} strokeWidth="2.4" style={{ transition: "fill .25s" }} className={glow ? "nv-pulse" : undefined} />

        {/* ears */}
        <g stroke={INK} strokeWidth="2.4" fill={BODY_MID}>
          <rect x="40" y="82" width="14" height="30" rx="7" />
          <rect x="166" y="82" width="14" height="30" rx="7" />
        </g>
        {/* shell */}
        <rect x="50" y="48" width="120" height="96" rx="40" fill={BODY} stroke={INK} strokeWidth="2.6" />
        <rect x="58" y="54" width="104" height="20" rx="10" fill="#fff" opacity="0.18" />
        {/* screen */}
        <rect x="62" y="66" width="96" height="66" rx="28" fill={SCREEN} stroke={INK} strokeWidth="2" />

        {/* cheeks */}
        <g style={{ opacity: face === "happy" || face === "delighted" ? 0.9 : 0, transition: "opacity .25s" }}>
          <ellipse cx="76" cy="108" rx="8" ry="4.5" fill="#F3797E" opacity="0.7" />
          <ellipse cx="144" cy="108" rx="8" ry="4.5" fill="#F3797E" opacity="0.7" />
        </g>

        <Eyes face={face} px={px} py={py} />
        <Mouth face={face} />
        {sleeping && (
          <g className="nv-zzz" fill={GLOW} fontWeight="700" fontSize="14">
            <text x="164" y="52">z</text>
            <text x="174" y="38" fontSize="11">z</text>
          </g>
        )}
        {prop === "cap" && <Accessory prop="cap" />}
      </g>

      {prop !== "cap" && <Accessory prop={prop} />}

      {/* feelings: hearts when very close, stars on click */}
      {look.level === 3 && !burst && (
        <g fill="#F3797E">
          <path className="nv-heart" style={{ animationDelay: "0s" }} d="M170 70c0-6 8-6 8 0 0-6 8-6 8 0 0 7-8 11-8 11s-8-4-8-11z" />
          <path className="nv-heart" style={{ animationDelay: ".5s" }} d="M36 76c0-5 7-5 7 0 0-5 7-5 7 0 0 6-7 9-7 9s-7-3-7-9z" />
        </g>
      )}
      {burst > 0 && (
        <g fill={ACCENT}>
          {[[30, 40], [188, 36], [24, 120], [198, 110]].map(([x, y], i) => (
            <path key={i} className="nv-star" style={{ animationDelay: `${i * 0.06}s` }} transform={`translate(${x} ${y})`} d="M0 -8l2.4 5.6 6 .6-4.6 4 1.4 5.8L0 4.8l-5.2 3.2 1.4-5.8-4.6-4 6-.6z" />
          ))}
        </g>
      )}
    </svg>
  );
}
