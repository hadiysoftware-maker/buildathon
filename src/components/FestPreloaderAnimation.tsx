"use client";

import React, { useId } from "react";

export interface FestPreloaderAnimationProps {
  size?: number;
  className?: string;
}

/**
 * Signature Fest-MS rotating diamond star loader restyled in Dark + Light Green.
 */
export function FestPreloaderAnimation({
  size = 84,
  className = "",
}: FestPreloaderAnimationProps) {
  const reactId = useId().replace(/:/g, "");
  const gradId = `sparkGrad_${reactId}`;
  const innerGradId = `sparkInnerGrad_${reactId}`;

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none overflow-visible ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading..."
    >
      <div
        className="absolute rounded-full bg-[#B3C8C4]/25 blur-2xl pointer-events-none anim-spark-glow"
        style={{ width: size * 1.45, height: size * 1.45 }}
      />

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 480 480"
        style={{ width: size, height: size }}
        className="relative z-10 overflow-visible"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="60%" stopColor="#292722" />
            <stop offset="100%" stopColor="#B3C8C4" />
          </linearGradient>
          <linearGradient id={innerGradId} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#ECF4F2" />
            <stop offset="100%" stopColor="#B3C8C4" />
          </linearGradient>
        </defs>

        <g className="anim-spark-main">
          <path
            d="M372.7 186.3 320 160l-26.3-52.7a60 60 0 0 0-107.4 0L160 160l-52.7 26.3a60 60 0 0 0 0 107.4L160 320l26.3 52.7a60 60 0 0 0 107.4 0L320 320l52.7-26.3a60 60 0 0 0 0-107.4Z"
            fill={`url(#${gradId})`}
          />
        </g>

        <g className="anim-spark-inner">
          <path
            d="M372.7 186.3 320 160l-26.3-52.7a60 60 0 0 0-107.4 0L160 160l-52.7 26.3a60 60 0 0 0 0 107.4L160 320l26.3 52.7a60 60 0 0 0 107.4 0L320 320l52.7-26.3a60 60 0 0 0 0-107.4Z"
            fill={`url(#${innerGradId})`}
            opacity="0.92"
          />
        </g>
      </svg>
    </div>
  );
}

export default FestPreloaderAnimation;

