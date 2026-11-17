/** Campus 2035 emblem: squircle with a graduation-cap diamond and a knowledge spark. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="61" height="61" rx="17" fill="var(--md-primary)" stroke="var(--md-outline)" strokeWidth="2" />
        {/* Mortarboard */}
        <path d="M32 18 12 28.5 32 39 52 28.5 32 18Z" fill="var(--md-on-primary)" />
        <path d="M21 34v7.5c0 2.2 5 5.5 11 5.5s11-3.300 11-5.500V34l-11 5.800L21 34Z" fill="var(--md-on-primary)" opacity="0.85" />
        <path d="M52 28.500V40" stroke="var(--md-on-primary)" strokeWidth="2.500" strokeLinecap="round" />
        {/* Spark */}
        <path d="M47 10l1.500 3.500L52 15l-3.500 1.500L47 20l-1.500-3.500L42 15l3.500-1.500L47 10Z" fill="var(--md-accent, var(--md-on-primary))" />
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
          Campus<span style={{ color: "var(--md-primary)" }}> 2035</span>
        </span>
        {sub ? (
          <span
            className="hidden sm:block text-[10px] font-medium uppercase tracking-wider truncate mt-0.5"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            {sub}
          </span>
        ) : null}
      </span>
    </span>
  );
}
