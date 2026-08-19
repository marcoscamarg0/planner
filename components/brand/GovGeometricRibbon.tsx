"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GovGeometricRibbonProps {
  className?: string;
  height?: number | string;
}

export function GovGeometricRibbon({ className, height = 8 }: GovGeometricRibbonProps) {
  return (
    <div
      className={cn("w-full overflow-hidden flex items-center select-none", className)}
      style={{ height }}
      role="presentation"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="ribbon-clip">
            <rect width="1200" height="40" />
          </clipPath>
        </defs>
        <g clipPath="url(#ribbon-clip)">
          {/* Segment 1: Yellow square + Green diamond + Blue circle */}
          <rect x="0" y="0" width="80" height="40" fill="#FFCC00" />
          <polygon points="40,2 78,20 40,38 2,20" fill="#009C3B" />
          <circle cx="40" cy="20" r="9" fill="#002776" />

          {/* Segment 2: White + Green circle */}
          <rect x="80" y="0" width="70" height="40" fill="#F4F4F4" />
          <circle cx="115" cy="20" r="14" fill="#009C3B" />

          {/* Segment 3: Yellow triangle + White */}
          <rect x="150" y="0" width="70" height="40" fill="#FFFFFF" />
          <polygon points="150,40 220,0 220,40" fill="#FFCC00" />

          {/* Segment 4: Blue triangle */}
          <rect x="220" y="0" width="70" height="40" fill="#0047FF" />
          <polygon points="220,0 290,0 220,40" fill="#FFFFFF" />

          {/* Segment 5: Yellow & White stripes + Green base */}
          <rect x="290" y="0" width="80" height="40" fill="#FFCC00" />
          <rect x="290" y="0" width="16" height="40" fill="#FFFFFF" />
          <rect x="322" y="0" width="16" height="40" fill="#FFFFFF" />
          <rect x="354" y="20" width="16" height="20" fill="#009C3B" />

          {/* Segment 6: Blue square + Green diamond + Yellow circle */}
          <rect x="370" y="0" width="80" height="40" fill="#0047FF" />
          <polygon points="410,2 448,20 410,38 372,20" fill="#009C3B" />
          <circle cx="410" cy="20" r="9" fill="#FFCC00" />

          {/* Segment 7: White + Green dot */}
          <rect x="450" y="0" width="70" height="40" fill="#FFFFFF" />
          <circle cx="485" cy="20" r="14" fill="#009C3B" />

          {/* Segment 8: Red vertical stripes */}
          <rect x="520" y="0" width="70" height="40" fill="#FFFFFF" />
          <rect x="520" y="0" width="12" height="40" fill="#E52207" />
          <rect x="539" y="0" width="12" height="40" fill="#E52207" />
          <rect x="558" y="0" width="12" height="40" fill="#E52207" />
          <rect x="577" y="0" width="13" height="40" fill="#E52207" />

          {/* Segment 9: Blue square + Yellow circle + Red wedge */}
          <rect x="590" y="0" width="80" height="40" fill="#0047FF" />
          <circle cx="630" cy="20" r="14" fill="#FFCC00" />
          <polygon points="650,40 670,20 670,40" fill="#E52207" />

          {/* Segment 10: Yellow square + Red circle */}
          <rect x="670" y="0" width="80" height="40" fill="#FFCC00" />
          <circle cx="710" cy="20" r="14" fill="#E52207" />

          {/* Segment 11: Green & White diagonal */}
          <rect x="750" y="0" width="70" height="40" fill="#FFFFFF" />
          <polygon points="750,0 820,0 750,40" fill="#009C3B" />

          {/* Segment 12: Blue & White stripes */}
          <rect x="820" y="0" width="70" height="40" fill="#FFFFFF" />
          <rect x="830" y="0" width="10" height="40" fill="#0047FF" />
          <rect x="850" y="0" width="10" height="40" fill="#0047FF" />
          <rect x="870" y="0" width="10" height="40" fill="#0047FF" />

          {/* Segment 13: Red square + Blue circle */}
          <rect x="890" y="0" width="80" height="40" fill="#E52207" />
          <circle cx="930" cy="20" r="14" fill="#0047FF" />

          {/* Segment 14: Yellow square + Green diamond + Blue circle */}
          <rect x="970" y="0" width="80" height="40" fill="#FFCC00" />
          <polygon points="1010,2 1048,20 1010,38 972,20" fill="#009C3B" />
          <circle cx="1010" cy="20" r="9" fill="#002776" />

          {/* Segment 15: Green circle + White */}
          <rect x="1050" y="0" width="70" height="40" fill="#FFFFFF" />
          <circle cx="1085" cy="20" r="14" fill="#009C3B" />

          {/* Segment 16: Yellow & Blue accent */}
          <rect x="1120" y="0" width="80" height="40" fill="#FFCC00" />
          <polygon points="1120,40 1200,0 1200,40" fill="#0047FF" />
        </g>
      </svg>
    </div>
  );
}
