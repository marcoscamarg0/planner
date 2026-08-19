"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PlannerBrandProps {
  className?: string;
  isCollapsed?: boolean;
  showSubtitle?: boolean;
}

export function PlannerBrand({
  className,
  isCollapsed = false,
  showSubtitle = true,
}: PlannerBrandProps) {
  if (isCollapsed) {
    return (
      <div
        className={cn(
          "w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-primary to-indigo-700 p-0.5 shadow-sm flex items-center justify-center transition-all hover:scale-105",
          className
        )}
        title="Planner — Ministério dos Transportes"
      >
        <div className="w-full h-full bg-[#0C326F] dark:bg-[#0B132B] rounded-[10px] flex items-center justify-center relative overflow-hidden">
          <div className="w-4 h-4 bg-[#FFCC00] rotate-45 flex items-center justify-center shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0047FF] flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      {/* Brand Icon */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-primary to-indigo-700 p-0.5 shadow-sm flex items-center justify-center shrink-0">
        <div className="w-full h-full bg-[#0C326F] dark:bg-[#0B132B] rounded-[10px] flex items-center justify-center relative overflow-hidden">
          <div className="w-4 h-4 bg-[#FFCC00] rotate-45 flex items-center justify-center shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0047FF] flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Brand Names */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-base tracking-tight text-foreground font-heading">
            Planner
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            MT
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[11px] font-medium text-muted-foreground truncate leading-tight">
            Min. dos Transportes
          </span>
        )}
      </div>
    </div>
  );
}
