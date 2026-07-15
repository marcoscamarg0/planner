import { cn } from "@/lib/utils";
import type { InsightType } from "@/types";
import { Sparkles, AlertCircle, TrendingUp, Lightbulb } from "lucide-react";

interface InsightBadgeProps {
  content: string;
  type: InsightType;
  compact?: boolean;
}

const iconMap: Record<InsightType, React.ElementType> = {
  summary: Sparkles,
  suggestion: Lightbulb,
  alert: AlertCircle,
  progress: TrendingUp,
};

const colorMap: Record<InsightType, string> = {
  summary: "text-primary bg-primary/10 border-primary/20",
  suggestion: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  alert: "text-red-400 bg-red-400/10 border-red-400/20",
  progress: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export function InsightBadge({ content, type, compact = false }: InsightBadgeProps) {
  const Icon = iconMap[type];
  const colorClass = colorMap[type];

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          colorClass
        )}
        role="note"
        aria-label={`Insight: ${content}`}
      >
        <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[200px]">{content}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border",
        colorClass
      )}
      role="note"
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}
