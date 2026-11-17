"use client";

import React from "react";
import { Mascot, type Mood, type Pose, type MascotProp } from "@/components/ui/Mascot";

export interface DashboardPreloaderProps {
  message?: string;
  subtext?: string;
  mood?: Mood;
  pose?: Pose;
  prop?: MascotProp;
  size?: number;
  role?: string;
  fullScreen?: boolean;
}

/**
 * Universal Scholar Owl Mascot ("Dac") Preloader for Desktop & Mobile.
 * Clean & minimal: ONLY the Mascot, Loading Page Name, and Page Description.
 */
export function DashboardPreloader({
  message,
  subtext,
  mood,
  pose,
  prop,
  size,
  role,
  fullScreen = true,
}: DashboardPreloaderProps) {
  void role;
  const routeCfg: { mood: Mood; pose: Pose; prop: MascotProp; message: string; subtext: string } = {
    mood: "happy",
    pose: "stand",
    prop: "book",
    message: "Loading",
    subtext: "",
  };

  const resolvedMood = mood || routeCfg.mood;
  const resolvedPose = pose || routeCfg.pose;
  const resolvedProp = prop || routeCfg.prop;
  const resolvedMessage = message || routeCfg.message;
  const resolvedSubtext = subtext !== undefined ? subtext : routeCfg.subtext;

  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-150 max-w-sm sm:max-w-md mx-auto">
      {/* Floating Scholar Owl Mascot with Route Emotion & Prop */}
      <div className="relative flex items-center justify-center mb-5 anim-mascot-float">
        <Mascot
          mood={resolvedMood}
          pose={resolvedPose}
          prop={resolvedProp}
          size={size || 135}
          className="ds-preloader-mascot"
        />
      </div>

      {/* Loading Page Name */}
      <h3
        className="text-xl sm:text-2xl font-bold font-heading tracking-tight"
        style={{ color: "var(--md-on-surface, #000000)" }}
      >
        {resolvedMessage}
      </h3>

      {/* Page Description */}
      {resolvedSubtext && (
        <p
          className="mt-2 text-xs sm:text-sm font-normal leading-relaxed max-w-xs sm:max-w-sm"
          style={{ color: "var(--md-on-surface-variant, #5C574C)" }}
        >
          {resolvedSubtext}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="ds-scope fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-150 overflow-hidden"
        style={{ background: "var(--md-bg, #ECF4F2)" }}
        role="status"
        aria-live="polite"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="w-full py-16 sm:py-24 flex items-center justify-center" role="status" aria-live="polite">
      {content}
    </div>
  );
}

export default DashboardPreloader;
