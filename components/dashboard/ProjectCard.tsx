"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MoreHorizontal, BarChart2, FileText, CheckSquare, Edit2, Trash2, Archive, Play, Pause } from "lucide-react";
import { cn, getProgressColor, getStatusLabel } from "@/lib/utils";
import { InsightBadge } from "./InsightBadge";
import type { ProjectWithStats, ProjectStatus } from "@/types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const supabase = createClient();

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    await supabase.from("projects").update({ status: newStatus }).eq("id", project.id);
    router.refresh();
  };

  const handleDelete = async () => {
    if (window.confirm(`Tem certeza que deseja apagar o projeto "${project.title}"? Todas as tarefas e páginas serão perdidas.`)) {
      await supabase.from("projects").delete().eq("id", project.id);
      router.refresh();
    }
  };

  const handleEdit = async () => {
    const newTitle = window.prompt("Novo título do projeto:", project.title);
    if (newTitle && newTitle.trim() !== "") {
      const newDesc = window.prompt("Nova descrição (opcional):", project.description || "");
      await supabase.from("projects").update({ 
        title: newTitle.trim(), 
        description: newDesc !== null ? newDesc.trim() : project.description 
      }).eq("id", project.id);
      router.refresh();
    }
  };

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
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                id={`project-menu-${project.id}`}
                aria-label={`Opções de ${project.title}`}
                onClick={(e) => e.preventDefault()}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground focus:opacity-100 z-10 relative"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="w-48 bg-card border border-border rounded-xl shadow-xl p-1 z-50 text-sm overflow-hidden animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu.Item
                  onSelect={handleEdit}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-accent focus:bg-accent text-foreground transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                  Editar
                </DropdownMenu.Item>
                
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                
                {project.status !== "active" && (
                  <DropdownMenu.Item
                    onSelect={() => handleStatusChange("active")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-accent focus:bg-accent text-foreground transition-colors"
                  >
                    <Play className="w-4 h-4 text-emerald-500" />
                    Ativar
                  </DropdownMenu.Item>
                )}
                {project.status !== "paused" && (
                  <DropdownMenu.Item
                    onSelect={() => handleStatusChange("paused")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-accent focus:bg-accent text-foreground transition-colors"
                  >
                    <Pause className="w-4 h-4 text-amber-500" />
                    Pausar
                  </DropdownMenu.Item>
                )}
                {project.status !== "archived" && (
                  <DropdownMenu.Item
                    onSelect={() => handleStatusChange("archived")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-accent focus:bg-accent text-foreground transition-colors"
                  >
                    <Archive className="w-4 h-4 text-muted-foreground" />
                    Arquivar
                  </DropdownMenu.Item>
                )}
                {project.status !== "completed" && (
                  <DropdownMenu.Item
                    onSelect={() => handleStatusChange("completed")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-accent focus:bg-accent text-foreground transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-primary" />
                    Concluir
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Separator className="h-px bg-border my-1" />

                <DropdownMenu.Item
                  onSelect={handleDelete}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-destructive/15 focus:bg-destructive/15 text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
