/**
 * Campus 2035 brand mark: a bold "C" ring (Campus) whose opening holds one amber square, a single cell of a
 * Smart ID code. Brand colours are fixed values (not theme tokens) so the mark never changes with the UI.
 * Variants: "color" (default), "mono" (one colour), "inverted" (for dark teal fields), "tile" (app icon / favicon).
 */
type Variant = "color" | "mono" | "inverted" | "tile";

const RING = "M43 21.1A17 17 0 1 0 43 42.9";

export function LogoMark({ size = 32, variant = "color" }: { size?: number; variant?: Variant }) {
  const ring = variant === "mono" ? "#0B2A2C" : variant === "color" ? "#0F766E" : "#FFFFFF";
  const cell = variant === "mono" ? "#0B2A2C" : "#F5B83D";
  return (
    <span className="inline-flex items-center justify-center shrink-0 select-none" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {variant === "tile" && <rect width="64" height="64" rx="16" fill="#0B4F4A" />}
        <g transform={variant === "tile" ? "translate(1 0)" : undefined}>
          <path d={variant === "tile" ? "M44 18.6A17 17 0 1 0 44 45.4" : RING} stroke={ring} strokeWidth="9" strokeLinecap="round" />
          <rect x={variant === "tile" ? 43 : 45} y="28" width="9" height="8" rx="2.5" fill={cell} />
        </g>
      </svg>
    </span>
  );
}

export function Logo({ size = 30, sub = "Smart classroom OS", variant = "color" }: { size?: number; sub?: string; variant?: Variant }) {
  const light = variant === "inverted";
  return (
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <LogoMark size={size} variant={variant} />
      <span className="flex flex-col leading-none min-w-0">
        <span className="font-heading font-bold text-base tracking-tight truncate" style={{ color: light ? "#FFFFFF" : "#0B2A2C" }}>
          Campus<span style={{ color: light ? "#F5B83D" : "#0F766E" }}> 2035</span>
        </span>
        {sub ? (
          <span className="hidden sm:block text-[10px] font-medium uppercase tracking-wider truncate mt-0.5" style={{ color: light ? "rgba(255,255,255,0.8)" : "#4B6B6D" }}>
            {sub}
          </span>
        ) : null}
      </span>
    </span>
  );
}
