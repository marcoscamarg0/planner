"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Zap,
  Activity,
  AlertCircle,
  FileText,
  Clock
} from "lucide-react";
import type { Profile, ProjectWithStats, Task, DashboardStats } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { InsightBadge } from "@/components/dashboard/InsightBadge";

interface DashboardClientProps {
  profile: Profile | null;
  projectsWithStats: ProjectWithStats[];
  allTasks: Task[];
  stats: DashboardStats;
}

interface ActivityItem {
  id: string;
  type: "project_updated" | "task_completed" | "qa_run" | "issue_found";
  title: string;
  description: string;
  date: Date;
  icon: any;
  color: string;
}

export function DashboardClient({
  profile,
  projectsWithStats,
  allTasks,
  stats,
}: DashboardClientProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [dashboardInsight, setDashboardInsight] = useState<string | null>(null);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário";

  useEffect(() => {
    if (projectsWithStats.length === 0) return;

    const fetchInsight = async () => {
      try {
        const res = await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectTitle: "todos os projetos",
            stats: {
              total_tasks: stats.total_tasks,
              completed_tasks: stats.completed_tasks,
              pages_count: projectsWithStats.reduce((a, p) => a + p.pages_count, 0),
              status: "active",
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setDashboardInsight(data.insight);
        }
      } catch {}
    };

    fetchInsight();
  }, [projectsWithStats, stats]);

  useEffect(() => {
    const parseDateSafe = (d?: string | Date | null) => {
      if (!d) return new Date();
      const p = new Date(d);
      return isNaN(p.getTime()) ? new Date() : p;
    };

    const feed: ActivityItem[] = [];
    
    projectsWithStats.slice(0, 5).forEach(p => {
      feed.push({
        id: `p-${p.id}`,
        type: "project_updated",
        title: p.title,
        description: "Projeto atualizado recentemente",
        date: parseDateSafe(p.updated_at),
        icon: FolderKanban,
        color: "text-blue-500 bg-blue-500/10"
      });
    });

    const completedTasks = allTasks.filter(t => t.status === "done").slice(0, 5);
    completedTasks.forEach(t => {
      feed.push({
        id: `t-${t.id}`,
        type: "task_completed",
        title: t.title,
        description: "Tarefa marcada como concluída",
        date: parseDateSafe(t.updated_at),
        icon: CheckSquare,
        color: "text-emerald-500 bg-emerald-500/10"
      });
    });

    feed.sort((a, b) => b.date.getTime() - a.date.getTime());
    setActivities(feed.slice(0, 10)); // Take top 10
  }, [projectsWithStats, allTasks]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight font-outfit text-foreground">
            {greeting()}, {firstName}.
          </h1>
          <p className="text-muted-foreground text-sm">
            Aqui está o que precisa da sua atenção hoje.
          </p>
        </div>
        
        {dashboardInsight && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            <InsightBadge content={dashboardInsight} type="progress" compact />
          </motion.div>
        )}
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Visão Geral
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium">Projetos Ativos</span>
            <span className="text-2xl font-semibold text-foreground font-outfit">{stats.active_projects}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium">Tarefas Pendentes</span>
            <span className="text-2xl font-semibold text-foreground font-outfit">{stats.total_tasks - stats.completed_tasks}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium">Testes (QA)</span>
            <span className="text-2xl font-semibold text-foreground font-outfit">24</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium">Problemas Encontrados</span>
            <span className="text-2xl font-semibold text-foreground font-outfit">2</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Feed de Atividade
        </h2>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem atividades recentes.</div>
          ) : (
            <div className="relative border-l border-border ml-3 space-y-6 pb-4">
              {activities.map((activity, i) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative pl-6"
                >
                  <div className={cn("absolute -left-3.5 top-0 w-7 h-7 rounded-full border-[3px] border-background flex items-center justify-center", activity.color)}>
                    <activity.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <span className="text-sm font-medium text-foreground">{activity.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.date, { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{activity.description}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
