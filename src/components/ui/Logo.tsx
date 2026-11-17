/**
 * Campus 2035 brand mark: an open book (learning) under a rising spark (the next decade),
 * on a deep-teal squircle. Colours are fixed brand values, not theme tokens, so the mark never changes.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0 select-none" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="c35-g" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14A394" />
            <stop offset="1" stopColor="#0B5D57" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#c35-g)" />
        <path d="M32 24.5c-4.2-3.2-9.8-4.2-16-3.5v21c6.2-.7 11.8.3 16 3.5 4.2-3.2 9.8-4.2 16-3.5v-21c-6.2-.7-11.8.3-16 3.5Z" fill="#fff" />
        <path d="M32 24.5v21" stroke="#0F766E" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M46 8l1.8 4.2L52 14l-4.2 1.8L46 20l-1.8-4.2L40 14l4.2-1.8L46 8Z" fill="#FFD66B" />
      </svg>
    </span>
  );
}

export function Logo({ size = 30, sub = "Smart classroom OS" }: { size?: number; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none min-w-0">
        <span className="font-heading font-bold text-base tracking-tight truncate" style={{ color: "var(--md-on-surface)" }}>
          Campus<span style={{ color: "#0F766E" }}> 2035</span>
        </span>
        {sub ? (
          <span className="hidden sm:block text-[10px] font-medium uppercase tracking-wider truncate mt-0.5" style={{ color: "var(--md-on-surface-variant)" }}>
            {sub}
          </span>
        ) : null}
      </span>
    </span>
  );
}
