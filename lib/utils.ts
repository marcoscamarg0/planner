import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy", { locale: ptBR });
}

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

export function getProgressColor(rate: number): string {
  if (rate >= 80) return "hsl(152, 69%, 39%)";
  if (rate >= 50) return "hsl(239, 84%, 67%)";
  if (rate >= 20) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Ativo",
    paused: "Pausado",
    completed: "Concluído",
    archived: "Arquivado",
    todo: "A fazer",
    in_progress: "Em progresso",
    done: "Concluído",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    urgent: "Urgente",
  };
  return labels[priority] ?? priority;
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: "text-emerald-400",
    medium: "text-indigo-400",
    high: "text-amber-400",
    urgent: "text-red-400",
  };
  return colors[priority] ?? "text-muted-foreground";
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function generateProjectColor(): string {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function extractTextFromTipTap(
  content: Record<string, unknown> | null
): string {
  if (!content) return "";

  const extract = (node: Record<string, unknown>): string => {
    if (node.type === "text") return (node.text as string) ?? "";
    if (node.content && Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[])
        .map(extract)
        .join(" ");
    }
    return "";
  };

  return extract(content).trim().slice(0, 2000);
}
