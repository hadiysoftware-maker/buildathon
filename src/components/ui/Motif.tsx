"use client";

export type MotifType = "bars" | "ring" | "grid" | "arc";

export const MOTIF_ORDER: MotifType[] = ["bars", "ring", "grid", "arc"];

/**
 * Minimal geometric watermark rendered gently in the corner of tonal StatTiles
 * using Khaki Beige (#B3C8C4) strokes.
 */
export function Motif({ type = "bars" }: { type?: MotifType }) {
  return (
    <svg
      aria-hidden="true"
      width="96"
      height="96"
      viewBox="0 0 96 96"
      style={{
        position: "absolute",
        right: -10,
        bottom: -10,
        pointerEvents: "none",
        opacity: 0.16,
        color: "currentColor",
        zIndex: 0,
      }}
    >
      {type === "bars" && (
        <g fill="currentColor">
          <rect x="20" y="54" width="12" height="34" rx="6" />
          <rect x="38" y="38" width="12" height="50" rx="6" />
          <rect x="56" y="20" width="12" height="68" rx="6" />
        </g>
      )}
      {type === "ring" && (
        <g fill="none" stroke="currentColor" strokeWidth="8">
          <circle cx="58" cy="58" r="28" />
          <circle cx="58" cy="58" r="14" />
        </g>
      )}
      {type === "grid" && (
        <g fill="currentColor">
          <circle cx="34" cy="34" r="5" />
          <circle cx="56" cy="34" r="5" />
          <circle cx="78" cy="34" r="5" />
          <circle cx="34" cy="56" r="5" />
          <circle cx="56" cy="56" r="5" />
          <circle cx="78" cy="56" r="5" />
        </g>
      )}
      {type === "arc" && (
        <g fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round">
          <path d="M22 76a44 44 0 0 1 56-56" />
          <path d="M40 76a26 26 0 0 1 38-38" />
        </g>
      )}
    </svg>
  );
}

