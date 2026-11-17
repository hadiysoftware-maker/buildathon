"use client";

import React from "react";
import { DashboardPreloader } from "@/components/DashboardPreloader";
import { FestPreloaderAnimation } from "@/components/FestPreloaderAnimation";
import type { Mood, Pose, MascotProp } from "@/components/ui/Mascot";

export function ShapeLoader({ size = "md" }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const px = size === "sm" ? 42 : size === "lg" ? 84 : 58;
  return <FestPreloaderAnimation size={px} />;
}

export function Preloader({
  label,
  subtext,
  mood,
  pose,
  prop,
  inline,
}: {
  label?: string;
  subtext?: string;
  mood?: Mood;
  pose?: Pose;
  prop?: MascotProp;
  inline?: boolean;
  onRetry?: () => void;
}) {
  return (
    <DashboardPreloader
      message={label}
      subtext={subtext}
      mood={mood}
      pose={pose}
      prop={prop}
      fullScreen={!inline}
    />
  );
}
