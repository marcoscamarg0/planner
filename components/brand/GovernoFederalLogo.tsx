"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GovernoFederalLogoProps {
  className?: string;
  variant?: "full" | "compact" | "badge";
  theme?: "light" | "dark" | "auto";
}

export function GovernoFederalLogo({
  className,
  variant = "full",
}: GovernoFederalLogoProps) {
  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-2 select-none", className)}>
        {/* Geometric Mini Brasil Icon */}
        <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 via-emerald-600 to-amber-500 p-[1.5px] shadow-sm">
          <div className="w-full h-full bg-card rounded-[6px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-90">
              <div className="bg-[#009C3B]" />
              <div className="bg-[#0047FF]" />
              <div className="bg-[#FFCC00]" />
              <div className="bg-[#E52207]" />
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm z-10" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
            Governo Federal
          </span>
          <span className="text-xs font-black tracking-tight text-foreground leading-tight">
            BRASIL
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center select-none font-sans", className)}>
      {/* Top Tagline */}
      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.28em] text-foreground/90 mb-1.5 text-center">
        Governo Federal
      </div>

      {/* Geometric BRASIL letters */}
      <svg
        viewBox="0 0 540 130"
        className="w-full max-w-[340px] sm:max-w-[420px] h-auto drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* === LETTER B === */}
        <g id="letter-B">
          {/* Top yellow block */}
          <rect x="10" y="55" width="40" height="40" fill="#FFCC00" />
          {/* Green vertical left bar with rounded top-left */}
          <path d="M 10 10 L 50 10 L 50 55 L 10 55 Z" fill="#009C3B" />
          <path d="M 10 10 Q 10 10 10 10" fill="#009C3B" />
          {/* Red lower semicircle */}
          <path d="M 50 55 A 40 40 0 0 1 50 135 L 50 55 Z" fill="#E52207" />
          <path d="M 50 10 A 45 45 0 0 1 50 95 L 50 55 Z" fill="#0047FF" opacity="0.95" />
          <rect x="10" y="10" width="40" height="125" fill="#009C3B" rx="14" />
          <rect x="10" y="70" width="40" height="65" fill="#FFCC00" />
          <path d="M 50 70 A 32 32 0 0 1 50 135 L 50 70 Z" fill="#E52207" />
          <path d="M 50 10 A 30 30 0 0 1 50 70 L 50 10 Z" fill="#0047FF" />
          {/* Clean Overlay B */}
          <rect x="10" y="10" width="38" height="60" fill="#009C3B" />
          <rect x="10" y="70" width="38" height="65" fill="#FFCC00" />
          <path d="M 48 10 C 78 10, 85 40, 85 40 C 85 40, 78 70, 48 70 Z" fill="#0047FF" />
          <path d="M 48 70 C 82 70, 92 102, 92 102 C 92 102, 82 135, 48 135 Z" fill="#E52207" />
          <circle cx="28" cy="40" r="12" fill="#009C3B" />
          <circle cx="28" cy="102" r="12" fill="#009C3B" />
        </g>

        {/* === LETTER R === */}
        <g id="letter-R" transform="translate(95, 0)">
          {/* Blue Quarter-Circle Top Right */}
          <path d="M 0 10 L 0 70 L 60 70 A 60 60 0 0 0 0 10 Z" fill="#0047FF" />
          {/* Green Triangle Bottom Left */}
          <polygon points="0,70 65,135 0,135" fill="#009C3B" />
          {/* Dark angle connector */}
          <polygon points="50,70 65,135 75,135 60,70" fill="#1E293B" opacity="0.3" />
        </g>

        {/* === LETTER A === */}
        <g id="letter-A" transform="translate(170, 0)">
          {/* Yellow Triangle */}
          <polygon points="55,10 115,135 -5,135" fill="#FFCC00" />
          {/* Blue Semicircle / Disc in base */}
          <path d="M 12 135 A 43 43 0 0 1 98 135 Z" fill="#0047FF" />
        </g>

        {/* === LETTER S === */}
        <g id="letter-S" transform="translate(295, 0)">
          {/* Green top quarter shape */}
          <path d="M 0 50 A 40 40 0 0 1 40 10 L 40 50 Z" fill="#009C3B" />
          <path d="M 40 10 L 75 10 A 40 40 0 0 1 75 90 L 40 90 Z" fill="#0047FF" />
          <rect x="0" y="50" width="40" height="40" fill="#009C3B" />
          {/* Red middle rectangle */}
          <rect x="0" y="65" width="40" height="70" fill="#E52207" />
          {/* Yellow bottom hook */}
          <path d="M 40 65 A 35 35 0 0 1 75 100 A 35 35 0 0 1 40 135 L 40 65 Z" fill="#FFCC00" />
        </g>

        {/* === LETTER I === */}
        <g id="letter-I" transform="translate(385, 0)">
          {/* Green tall rectangle */}
          <rect x="0" y="10" width="42" height="125" fill="#009C3B" />
        </g>

        {/* === LETTER L === */}
        <g id="letter-L" transform="translate(440, 0)">
          {/* Yellow tall rectangle */}
          <rect x="0" y="10" width="42" height="125" fill="#FFCC00" />
          {/* Charcoal base */}
          <rect x="0" y="90" width="42" height="45" fill="#334155" />
          {/* Blue bottom right extension */}
          <rect x="42" y="90" width="45" height="45" fill="#0047FF" />
        </g>
      </svg>

      {/* Bottom Tagline */}
      <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.32em] text-foreground/80 mt-2 text-center">
        União e Reconstrução
      </div>
    </div>
  );
}
