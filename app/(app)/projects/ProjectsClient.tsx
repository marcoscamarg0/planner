"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FolderKanban, Plus, Trash2, CheckSquare, Square, MoreHorizontal, ArrowRight } from "lucide-react";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { useRouter } from "next/navigation";
import { cn, getStatusLabel } from "@/lib/utils";
import type { ProjectWithStats, Project, ProjectStatus } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface ProjectsClientProps {
  projectsWithStats?: ProjectWithStats[];
  initialProjects?: ProjectWithStats[];
  userId?: string;
  currentUserId?: string;
}

export function ProjectsClient({
  projectsWithStats,
  initialProjects,
  userId,
  currentUserId,
}: ProjectsClientProps) {
  const initial = projectsWithStats ?? initialProjects ?? [];
  const [projects, setProjects] = useState<ProjectWithStats[]>(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
    window.open(`/projects/${project.id}`, "_blank");
    router.refresh();
  };

  const displayProjects = useMemo(() => {
    const list = projects ?? [];
    const isFiltering = search.trim() !== "" || statusFilter !== "all";
    const filtered = list.filter((p) => {
      const matchSearch =
        search.trim() === "" ||
        (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
    return isFiltering ? filtered : list.filter((p) => !p.parent_id);
  }, [projects, search, statusFilter]);

  const statusFilters: { value: ProjectStatus | "all"; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Ativos" },
    { value: "paused", label: "Pausados" },
    { value: "completed", label: "Concluídos" },
    { value: "archived", label: "Arquivados" },
  ];

  const handleToggleSelect = (projectId: string) => {
    const next = new Set(selectedIds);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    setSelectedIds(next);
  };

  const allDisplayedIds = useMemo(() => displayProjects.map(p => p.id), [displayProjects]);
  const isAllSelected = displayProjects.length > 0 && allDisplayedIds.every(id => selectedIds.has(id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allDisplayedIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja apagar ${selectedIds.size} projeto(s)? Esta ação não pode ser desfeita.`)) return;
    
    setIsDeletingBulk(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const { error } = await supabase.from("projects").delete().in("id", idsToDelete);
      if (error) throw error;
      
      setProjects(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      console.error("Error deleting projects:", error);
      alert("Erro ao apagar projetos.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-outfit">Projetos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {displayProjects.length} projeto{displayProjects.length !== 1 ? "s" : ""} ativo{displayProjects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md text-sm font-medium hover:bg-destructive/20 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingBulk ? "Apagando..." : `Apagar (${selectedIds.size})`}
              </button>
            )}
            <button
              onClick={() => setNewProjectOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo projeto
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                  statusFilter === f.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar projetos..."
              className="w-full pl-9 pr-4 py-2 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {displayProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border border-dashed p-16 text-center bg-surface/50"
          >
            <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-sm font-medium text-foreground mb-1">
              {search ? "Nenhum projeto encontrado." : "Nenhum projeto ainda."}
            </p>
            <p className="text-xs text-muted-foreground">
              {search
                ? "Tente ajustar seus filtros"
                : "Crie seu primeiro projeto para começar a organizar seu trabalho."}
            </p>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground text-xs font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <button onClick={handleToggleSelectAll} className="outline-none">
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">Projeto</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Progresso</th>
                  <th className="px-4 py-3 font-medium text-center">Tarefas</th>
                  <th className="px-4 py-3 font-medium text-center">QA</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayProjects.map((project, index) => {
                  const progressRate = project.status === "completed"
                    ? 100
                    : project.total_tasks > 0
                    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
                    : 0;
                  const isSelected = selectedIds.has(project.id);

                  return (
                    <motion.tr 
                      key={project.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.2 }}
                      className={cn(
                        "group transition-colors",
                        isSelected ? "bg-primary/5" : "hover:bg-accent/50"
                      )}
                    >
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleSelect(project.id)} className="outline-none text-muted-foreground hover:text-foreground">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 min-w-[200px] max-w-[300px]">
                        <Link
                          href={`/projects/${project.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${project.color}20` }}>
                            <span className="text-sm">{project.emoji ?? "📁"}</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground truncate">{project.title}</span>
                            {project.description && (
                              <span className="text-xs text-muted-foreground truncate">{project.description}</span>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            project.status === "active" ? "bg-emerald-500" :
                            project.status === "paused" ? "bg-amber-500" :
                            project.status === "completed" ? "bg-primary" : "bg-muted-foreground"
                          )} />
                          <span className="text-xs capitalize text-muted-foreground">
                            {project.status === "active" ? "Ativo" :
                             project.status === "paused" ? "Pausado" :
                             project.status === "completed" ? "Concluído" : "Arquivado"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-48">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted/80 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progressRate}%`,
                                backgroundColor: progressRate > 0 ? (project.color || "#6366f1") : undefined,
                              }}
                            />
                          </div>
                          <span className={cn(
                            "text-xs font-semibold w-9 text-right",
                            progressRate > 0 ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {progressRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground text-xs font-medium">
                        {project.completed_tasks}/{project.total_tasks}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Aprovado
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link 
                          href={`/projects/${project.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border transition-all"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleProjectCreated}
        projects={projects}
      />
    </>
  );
}
