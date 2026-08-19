"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MinisterioTransportesLogoProps {
  className?: string;
  variant?: "horizontal" | "stacked" | "compact" | "badge";
  showRibbon?: boolean;
}

export function MinisterioTransportesLogo({
  className,
  variant = "horizontal",
  showRibbon = false,
}: MinisterioTransportesLogoProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 select-none", className)}>
        {/* Emblem: Blue Circle with Green Diamond */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-blue-700 to-blue-950 p-0.5 shadow-sm flex items-center justify-center relative overflow-hidden">
          <div className="w-full h-full bg-[#0C326F] rounded-[6px] flex items-center justify-center relative">
            {/* Diamond */}
            <div className="w-4 h-4 bg-[#FFCC00] rotate-45 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#002776]" />
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-medium tracking-wide text-muted-foreground uppercase leading-none">
            Ministério dos
          </span>
          <span className="text-xs font-black tracking-tight text-foreground uppercase leading-tight font-sans">
            Transportes
          </span>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-start select-none font-sans", className)}>
        <span className="text-xs font-medium tracking-normal text-muted-foreground">
          Ministério dos
        </span>
        <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground uppercase">
          TRANSPORTES
        </span>
        {showRibbon && (
          <div className="w-full h-1.5 rounded-full mt-2 bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0047FF] to-[#E52207]" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-3 select-none font-sans", className)}>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-primary to-blue-900 p-0.5 shadow-md flex items-center justify-center shrink-0">
        <div className="w-full h-full bg-[#0C326F] rounded-[10px] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:6px_6px]" />
          {/* Brazil Flag Inspired Emblem */}
          <div className="w-5 h-5 bg-[#FFCC00] rotate-45 flex items-center justify-center shadow-inner">
            <div className="w-3 h-3 rounded-full bg-[#0047FF] flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-none">
          Ministério dos
        </span>
        <span className="text-base sm:text-lg font-black tracking-tight text-foreground uppercase leading-tight">
          TRANSPORTES
        </span>
      </div>
    </div>
  );
}
