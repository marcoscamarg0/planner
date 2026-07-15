"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, FolderKanban, Plus, Grid, List } from "lucide-react";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ProjectWithStats, Project, ProjectStatus } from "@/types";

interface ProjectsClientProps {
  projectsWithStats: ProjectWithStats[];
}

type ViewMode = "grid" | "list";

export function ProjectsClient({ projectsWithStats }: ProjectsClientProps) {
  const [projects, setProjects] = useState(projectsWithStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const router = useRouter();

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [
      {
        ...project,
        total_tasks: 0,
        completed_tasks: 0,
        pages_count: 0,
        last_insight: undefined,
      },
      ...prev,
    ]);
    setNewProjectOpen(false);
    router.push(`/projects/${project.id}`);
    router.refresh();
  };

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusFilters: { value: ProjectStatus | "all"; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Ativos" },
    { value: "paused", label: "Pausados" },
    { value: "completed", label: "Concluídos" },
    { value: "archived", label: "Arquivados" },
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length} projeto{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            id="projects-new-btn"
            onClick={() => setNewProjectOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo projeto
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="projects-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              aria-label="Buscar projetos"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-1">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-medium transition-all",
                  statusFilter === f.value
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Visualização em grade"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                viewMode === "grid"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="Visualização em lista"
              aria-pressed={viewMode === "list"}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                viewMode === "list"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-16 text-center"
          >
            <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium text-foreground mb-1">
              {search ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Tente outros termos de busca"
                : "Crie seu primeiro projeto para começar"}
            </p>
          </motion.div>
        ) : (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                : "flex flex-col gap-3"
            )}
          >
            {filtered.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleProjectCreated}
      />
    </>
  );
}
