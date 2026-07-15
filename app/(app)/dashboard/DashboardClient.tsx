"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Zap,
  Plus,
} from "lucide-react";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { InsightBadge } from "@/components/dashboard/InsightBadge";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { Profile, ProjectWithStats, Task, DashboardStats } from "@/types";

interface DashboardClientProps {
  profile: Profile | null;
  projectsWithStats: ProjectWithStats[];
  allTasks: Task[];
  stats: DashboardStats;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  index: number;
}

function StatCard({ label, value, icon: Icon, color, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </motion.div>
  );
}

export function DashboardClient({
  profile,
  projectsWithStats,
  allTasks,
  stats,
}: DashboardClientProps) {
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
              pages_count: projectsWithStats.reduce(
                (a, p) => a + p.pages_count,
                0
              ),
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
  }, []);

  const statCards = [
    {
      label: "Projetos ativos",
      value: stats.active_projects,
      icon: FolderKanban,
      color: "#6366f1",
    },
    {
      label: "Tarefas concluídas",
      value: stats.completed_tasks,
      icon: CheckSquare,
      color: "#10b981",
    },
    {
      label: "Total de tarefas",
      value: stats.total_tasks,
      icon: Zap,
      color: "#8b5cf6",
    },
    {
      label: "Taxa de conclusão",
      value: `${stats.completion_rate}%`,
      icon: TrendingUp,
      color: "#f97316",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()},{" "}
          <span className="gradient-text">{firstName}</span> 👋
        </h1>
        <p className="text-muted-foreground text-sm">
          Você tem{" "}
          <span className="text-foreground font-medium">
            {stats.total_tasks - stats.completed_tasks}
          </span>{" "}
          tarefas pendentes em{" "}
          <span className="text-foreground font-medium">
            {stats.active_projects}
          </span>{" "}
          projetos ativos.
        </p>
        {dashboardInsight && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <InsightBadge content={dashboardInsight} type="progress" compact />
          </motion.div>
        )}
      </motion.div>

      <section aria-label="Estatísticas gerais">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <StatCard key={card.label} {...card} index={i} />
          ))}
        </div>
      </section>

      {allTasks.length > 0 && (
        <section aria-label="Relatórios de progresso">
          <ProgressChart tasks={allTasks} />
        </section>
      )}

      <section aria-label="Projetos recentes">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            Projetos recentes
          </h2>
        </div>

        {projectsWithStats.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              Nenhum projeto ainda
            </h3>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro projeto para começar a organizar suas tarefas.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectsWithStats.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
