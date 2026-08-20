"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FolderKanban, Plus, Trash2, CheckSquare, Square, MoreHorizontal, ArrowRight, ChevronDown, ChevronRight, CornerDownRight, Zap, History, Loader2 } from "lucide-react";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { MultiSubprojectRunnerModal } from "@/components/qa/MultiSubprojectRunnerModal";
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
  const [multiRunnerOpen, setMultiRunnerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Sincroniza initialProjects se mudarem
  useEffect(() => {
    if (initialProjects && initialProjects.length > 0) {
      setProjects(initialProjects);
    }
  }, [initialProjects]);

  // ── Auto-refresh totalmente automático em tempo real ──
  useEffect(() => {
    const fetchLatestProjects = async () => {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          if (data.projectsWithStats && Array.isArray(data.projectsWithStats) && data.projectsWithStats.length > 0) {
            setProjects(data.projectsWithStats);
          }
        }
      } catch {}
    };

    // Polling a cada 15s apenas se a aba estiver visível
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLatestProjects();
      }
    }, 15000);

    // Atualização imediata ao focar na janela ou mudar de aba
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        fetchLatestProjects();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "planner_tasks_updated") {
        fetchLatestProjects();
      }
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

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

  const toggleExpandParent = (parentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const isSubproject = (p: ProjectWithStats, all: ProjectWithStats[]) => {
    if (!p.parent_id) return false;
    const pid = String(p.parent_id).trim();
    if (!pid || pid === "null" || pid === "undefined" || pid === "none") return false;
    if (pid === p.id) return false;
    return all.some((other) => other.id === pid && other.id !== p.id);
  };

  const getSubprojects = (parentId: string) => {
    return (projects ?? []).filter((p) => {
      if (!p.parent_id) return false;
      const pid = String(p.parent_id).trim();
      return pid === parentId && pid !== p.id;
    });
  };

  const displayProjects = useMemo(() => {
    const list = projects ?? [];
    const isSearching = search.trim() !== "";

    if (isSearching) {
      return list.filter((p) => {
        const matchSearch =
          (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.description ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "all" || p.status === statusFilter;
        return matchSearch && matchStatus;
      });
    }

    // Exibe projetos principais
    const roots = list.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return !isSubproject(p, list) && matchStatus;
    });

    // Se todos os projetos fossem filtrados como subprojetos, exibe a lista completa para garantir visibilidade
    if (roots.length === 0 && list.length > 0 && statusFilter === "all") {
      return list;
    }

    return roots;
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

  const handleDeleteSingle = async (projectId: string, projectTitle: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar o projeto "${projectTitle}"? Todas as tarefas e páginas serão removidas.`)) return;

    // Remove imediatamente da interface (otimista)
    setProjects(prev => prev.filter(p => p.id !== projectId && (p as any).$id !== projectId));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });

    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao apagar o projeto");
      }
      router.refresh();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      alert(`Erro ao apagar o projeto: ${error.message}`);
      router.refresh();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja apagar ${selectedIds.size} projeto(s)? Esta ação removerá os projetos e suas tarefas definitivamente.`)) return;
    
    setIsDeletingBulk(true);
    const idsToDelete = Array.from(selectedIds);

    // Remove imediatamente da interface (otimista)
    setProjects(prev => prev.filter(p => !selectedIds.has(p.id) && !selectedIds.has((p as any).$id)));
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: idsToDelete }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao apagar projetos");
      }
      router.refresh();
    } catch (error: any) {
      console.error("Error deleting projects:", error);
      alert(`Erro ao apagar projetos: ${error.message}`);
      router.refresh();
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const [isLinking, setIsLinking] = useState(false);
  const handleLinkPreviousReports = async (targetId?: string) => {
    const projId = targetId || (selectedIds.size > 0 ? Array.from(selectedIds)[0] : undefined);
    setIsLinking(true);
    try {
      const res = await fetch("/api/automation/link-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao vincular relatórios");
      alert(`✅ ${data.message || "Testes anteriores vinculados com sucesso!"}`);
      window.location.reload();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsLinking(false);
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
            <button
              onClick={() => handleLinkPreviousReports()}
              disabled={isLinking || displayProjects.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-background border border-border text-foreground rounded-md text-sm font-medium hover:bg-accent/60 transition-all disabled:opacity-50"
              title="Importa e associa todos os testes e relatórios de auditoria já executados para os projetos cadastrados"
            >
              {isLinking ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <History className="w-4 h-4 text-primary" />}
              <span>Vincular Testes Anteriores</span>
            </button>

            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => setMultiRunnerOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-sm shadow-primary/20"
                  title="Gera casos de teste e executa testes automatizados para os projetos selecionados sem sair da tela"
                >
                  <Zap className="w-4 h-4" />
                  Testar com IA ({selectedIds.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                  className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md text-sm font-medium hover:bg-destructive/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeletingBulk ? "Apagando..." : `Apagar (${selectedIds.size})`}
                </button>
              </>
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
                  const subProjects = getSubprojects(project.id);
                  const totalTasks = project.total_tasks || 0;
                  const completedTasks = project.completed_tasks || 0;
                  const progressRate = project.status === "completed"
                    ? 100
                    : totalTasks > 0
                    ? Math.round((completedTasks / totalTasks) * 100)
                    : 0;
                  const isSelected = selectedIds.has(project.id);
                  const isExpanded = expandedParents.has(project.id);

                  return (
                    <React.Fragment key={project.id}>
                      <motion.tr 
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
                        <td className="px-4 py-3 min-w-[220px] max-w-[320px]">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/projects/${project.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 min-w-0"
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

                            {subProjects.length > 0 && (
                              <button
                                onClick={(e) => toggleExpandParent(project.id, e)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all shrink-0 cursor-pointer"
                                title="Ver subprojetos"
                              >
                                <span>{subProjects.length} sub</span>
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
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
                          {completedTasks}/{totalTasks}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Aprovado
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleLinkPreviousReports(project.id)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                              title="Vincular todos os testes anteriores a este projeto"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingle(project.id, project.title)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer"
                              title="Apagar projeto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <Link 
                              href={`/projects/${project.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                              title="Abrir detalhes do projeto"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </motion.tr>

                      {/* Subprojetos Aninhados */}
                      {isExpanded && subProjects.map((sub) => {
                        const subProgress = sub.status === "completed"
                          ? 100
                          : sub.total_tasks > 0
                          ? Math.round((sub.completed_tasks / sub.total_tasks) * 100)
                          : 0;
                        const isSubSelected = selectedIds.has(sub.id);

                        return (
                          <tr
                            key={sub.id}
                            className={cn(
                              "bg-muted/30 hover:bg-muted/50 transition-colors border-l-2 border-l-primary/40",
                              isSubSelected && "bg-primary/5"
                            )}
                          >
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={() => handleToggleSelect(sub.id)} className="outline-none text-muted-foreground hover:text-foreground">
                                {isSubSelected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 pl-8">
                              <Link
                                href={`/projects/${sub.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${sub.color}20` }}>
                                  <span className="text-xs">{sub.emoji ?? "📁"}</span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-medium text-foreground truncate">{sub.title}</span>
                                  {sub.description && (
                                    <span className="text-[10px] text-muted-foreground truncate">{sub.description}</span>
                                  )}
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  sub.status === "active" ? "bg-emerald-500" :
                                  sub.status === "paused" ? "bg-amber-500" :
                                  sub.status === "completed" ? "bg-primary" : "bg-muted-foreground"
                                )} />
                                <span className="text-[11px] capitalize text-muted-foreground">
                                  {sub.status === "active" ? "Ativo" :
                                   sub.status === "paused" ? "Pausado" :
                                   sub.status === "completed" ? "Concluído" : "Arquivado"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 w-48">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${subProgress}%`,
                                      backgroundColor: subProgress > 0 ? (sub.color || "#6366f1") : undefined,
                                    }}
                                  />
                                </div>
                                <span className={cn(
                                  "text-[11px] font-semibold w-9 text-right",
                                  subProgress > 0 ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {subProgress}%
                                </span>
                              </div>
                            </td>
                          <td className="px-4 py-2.5 text-center text-muted-foreground text-xs font-medium">
                            {sub.completed_tasks}/{sub.total_tasks}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              Aprovado
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleLinkPreviousReports(sub.id)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                                title="Vincular todos os testes anteriores a este subprojeto"
                              >
                                <History className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteSingle(sub.id, sub.title)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer"
                                title="Apagar subprojeto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <Link 
                                href={`/projects/${sub.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                                title="Abrir detalhes"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </React.Fragment>
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

      <MultiSubprojectRunnerModal
        open={multiRunnerOpen}
        onClose={() => setMultiRunnerOpen(false)}
        subProjects={projects.filter((p) => selectedIds.has(p.id))}
        initialSelectedIds={Array.from(selectedIds)}
        onFinished={() => router.refresh()}
      />
    </>
  );
}
