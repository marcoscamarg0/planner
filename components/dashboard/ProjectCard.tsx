"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MoreHorizontal, BarChart2, FileText, CheckSquare } from "lucide-react";
import { cn, getProgressColor, getStatusLabel } from "@/lib/utils";
import { InsightBadge } from "./InsightBadge";
import type { ProjectWithStats } from "@/types";

interface ProjectCardProps {
  project: ProjectWithStats;
  index?: number;
}

export function ProjectCard({ project, index = 0 }: ProjectCardProps) {
  const progressRate =
    project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : 0;

  const progressColor = getProgressColor(progressRate);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="bg-card border border-border shadow-sm hover:shadow-md hover:border-border/80 rounded-2xl p-5 group cursor-pointer transition-all duration-300"
      aria-label={`Projeto: ${project.title}`}
    >
      <Link href={`/projects/${project.id}`} className="block space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${project.color}20` }}
              aria-hidden="true"
            >
              {project.emoji ?? "📁"}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground text-sm truncate">
                {project.title}
              </h2>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  project.status === "active" && "bg-emerald-500/15 text-emerald-400",
                  project.status === "paused" && "bg-amber-500/15 text-amber-400",
                  project.status === "completed" && "bg-primary/15 text-primary",
                  project.status === "archived" && "bg-muted text-muted-foreground"
                )}
              >
                {getStatusLabel(project.status)}
              </span>
            </div>
          </div>
          <button
            id={`project-menu-${project.id}`}
            aria-label={`Opções de ${project.title}`}
            onClick={(e) => e.preventDefault()}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
            {project.completed_tasks}/{project.total_tasks} tarefas
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            {project.pages_count} páginas
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
            {progressRate}%
          </span>
        </div>

        <div className="space-y-1.5">
          <div
            className="h-1.5 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progressRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso: ${progressRate}%`}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: progressColor }}
              initial={{ width: 0 }}
              animate={{ width: `${progressRate}%` }}
              transition={{ duration: 0.8, delay: index * 0.06 + 0.2, ease: "easeOut" }}
            />
          </div>
        </div>

        {project.last_insight && (
          <InsightBadge
            content={project.last_insight.content}
            type={project.last_insight.type}
            compact
          />
        )}
      </Link>
    </motion.article>
  );
}
