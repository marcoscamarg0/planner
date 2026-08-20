"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderKanban,
  Network,
  ArrowLeft,
  ArrowRight,
  Zap,
  Play,
  CheckSquare,
  Square,
  Sparkles,
  Bot,
  Compass,
  Globe,
  Trash2,
  Loader2,
  AlertTriangle,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { MultiSubprojectRunnerModal } from "@/components/qa/MultiSubprojectRunnerModal";
import type { Project, ProjectWithStats } from "@/types";

interface ParentProjectClientProps {
  project: Project;
  subProjects: ProjectWithStats[];
  currentUserId: string;
}

export function ParentProjectClient({ project, subProjects, currentUserId }: ParentProjectClientProps) {
  const [items, setItems] = useState<ProjectWithStats[]>(subProjects);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [multiRunnerOpen, setMultiRunnerOpen] = useState(false);
  const [runnerInitialMode, setRunnerInitialMode] = useState<"existing" | "discover">("existing");
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(new Set());
  const [activeRunnerSubIds, setActiveRunnerSubIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setItems(subProjects);
  }, [subProjects]);

  const handleProjectCreated = (newProject: Project) => {
    setNewProjectOpen(false);
    router.refresh();
  };

  const toggleSelectSub = (subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSubIds.size === items.length) {
      setSelectedSubIds(new Set());
    } else {
      setSelectedSubIds(new Set(items.map((s) => s.id)));
    }
  };

  const handleOpenBatchRunner = (specificSubId?: string) => {
    setRunnerInitialMode("existing");
    if (specificSubId) {
      setActiveRunnerSubIds([specificSubId]);
    } else if (selectedSubIds.size > 0) {
      setActiveRunnerSubIds(Array.from(selectedSubIds));
    } else {
      setActiveRunnerSubIds(items.map((s) => s.id));
    }
    setMultiRunnerOpen(true);
  };

  const handleOpenDiscoveryRunner = () => {
    setRunnerInitialMode("discover");
    setMultiRunnerOpen(true);
  };

  // ── EXCLUSÃO INDIVIDUAL DE SUBPROJETO ──
  const handleDeleteSingle = async (id: string, title: string) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o subprojeto "${title}"?\n\nEsta ação apagará permanentemente todas as tarefas, páginas e relatórios associados.`
    );
    if (!confirmed) return;

    // Atualização otimista imediata na UI
    setItems((prev) => prev.filter((p) => p.id !== id && (p as any).$id !== id));
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Falha ao excluir subprojeto no servidor");
      }

      router.refresh();
    } catch (err: any) {
      console.error("Erro ao excluir subprojeto:", err);
      alert(`Erro: ${err.message}`);
      router.refresh();
    }
  };

  // ── EXCLUSÃO EM MASSA DE SUBPROJETOS SELECIONADOS ──
  const handleDeleteBulk = async () => {
    const ids = Array.from(selectedSubIds);
    if (ids.length === 0) return;

    const confirmed = window.confirm(
      `ATENÇÃO: Deseja realmente excluir permanentemente os ${ids.length} subprojeto(s) selecionado(s)?\n\nTodas as tarefas e relatórios desses subprojetos serão excluídos.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    // Atualização otimista imediata
    setItems((prev) => prev.filter((p) => !selectedSubIds.has(p.id) && !selectedSubIds.has((p as any).$id)));
    setSelectedSubIds(new Set());

    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: ids }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Falha ao excluir subprojetos no servidor");
      }

      router.refresh();
    } catch (err: any) {
      console.error("Erro ao excluir em lote:", err);
      alert(`Erro: ${err.message}`);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const [isLinking, setIsLinking] = useState(false);
  const handleLinkPreviousReports = async (subId?: string) => {
    const targetId = subId || (items[0]?.id);
    if (!targetId) {
      alert("Nenhum subprojeto selecionado para vincular.");
      return;
    }
    setIsLinking(true);
    try {
      const res = await fetch("/api/automation/link-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao vincular relatórios");
      alert(`✅ ${data.message || "Testes anteriores vinculados com sucesso ao subprojeto!"}`);
      window.location.reload();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  const isAllSelected = items.length > 0 && selectedSubIds.size === items.length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background/50 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/projects")}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors"
              title="Voltar para Projetos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{project.emoji || "📁"}</span>
                <h1 className="text-2xl font-bold text-foreground">
                  {project.title}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                  Projeto Agrupador
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {project.description || "Projeto mãe/agrupador de subprojetos."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => handleLinkPreviousReports()}
              disabled={isLinking || items.length === 0}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-background border border-border text-foreground hover:bg-accent/60 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              title="Importa e associa todos os testes e relatórios de auditoria já executados para o subprojeto CDT"
            >
              {isLinking ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <History className="w-4 h-4 text-primary" />}
              <span>Vincular Testes Anteriores</span>
            </button>

            <button
              onClick={handleOpenDiscoveryRunner}
              className="flex items-center gap-2 px-4 py-2.5 bg-background border border-primary/40 text-primary hover:bg-primary/10 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all shadow-sm"
              title="Varrer site raiz (ex: Carta de Serviços do Ministério dos Transportes) para auto-criar subprojetos e executar testes"
            >
              <Compass className="w-4 h-4" />
              <span>Auto-Descobrir via Site Raiz</span>
            </button>

            {items.length > 0 && (
              <button
                onClick={() => handleOpenBatchRunner()}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                title="Executa casos de teste e auditorias em lote para todos os subprojetos sem sair da tela"
              >
                <Zap className="w-4 h-4" />
                <span>Testar Subprojetos em Lote</span>
              </button>
            )}

            <button
              onClick={() => setNewProjectOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo subprojeto
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3.5">
            <Network className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-primary">Projeto Mãe (Agrupador Inteligente)</h3>
                <span className="text-xs text-primary/80 font-medium bg-primary/10 px-2 py-0.5 rounded-md">
                  Gestão & Automação Multi-Subprojetos
                </span>
              </div>
              <p className="text-sm text-primary/80 mt-1">
                Este projeto agrupa seus subprojetos. Você pode selecionar múltiplos subprojetos com as caixas de seleção para <strong>executar testes em lote</strong> ou <strong>excluir em massa</strong>, além de importar novos serviços via site raiz.
              </p>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar (when subprojects are selected) */}
        {selectedSubIds.size > 0 && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckSquare className="w-4 h-4" />
              <span>{selectedSubIds.size} subprojeto{selectedSubIds.size === 1 ? "" : "s"} selecionado{selectedSubIds.size === 1 ? "" : "s"}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedSubIds(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Limpar Seleção
              </button>

              <button
                onClick={handleDeleteBulk}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold transition-colors disabled:opacity-50"
                title="Excluir permanentemente todos os subprojetos selecionados"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Excluir Selecionados ({selectedSubIds.size})</span>
              </button>

              <button
                onClick={() => handleOpenBatchRunner()}
                className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                Executar Selecionados ({selectedSubIds.size})
              </button>
            </div>
          </div>
        )}

        {/* Subprojects Grid / Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              Subprojetos
              <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </h2>

            {items.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                {isAllSelected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                {isAllSelected ? "Desmarcar Todos" : "Selecionar Todos"}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="glass rounded-2xl p-16 text-center border-dashed border-2 border-border/50">
              <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium text-foreground mb-1">
                Nenhum subprojeto cadastrado
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Crie um subprojeto ou use a auto-descoberta via Carta de Serviços para importar serviços automaticamente.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleOpenDiscoveryRunner}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <Compass className="w-4 h-4" />
                  Auto-Descobrir via Site Raiz
                </button>
                <button
                  onClick={() => setNewProjectOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Criar Manualmente
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground text-xs font-medium border-b border-border">
                  <tr>
                    <th className="w-10 px-4 py-3 text-center">
                      <button
                        onClick={toggleSelectAll}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">Subprojeto</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Progresso</th>
                    <th className="px-4 py-3 font-medium text-center">Tarefas</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((sub) => {
                    const progressRate =
                      sub.total_tasks > 0
                        ? Math.round((sub.completed_tasks / sub.total_tasks) * 100)
                        : 0;
                    const isSelected = selectedSubIds.has(sub.id);

                    return (
                      <tr
                        key={sub.id}
                        onClick={() => router.push(`/projects/${sub.id}`)}
                        className={`group transition-colors cursor-pointer ${
                          isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/50"
                        }`}
                      >
                        <td
                          className="w-10 px-4 py-3 text-center"
                          onClick={(e) => toggleSelectSub(sub.id, e)}
                        >
                          <button className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 min-w-[200px] max-w-[300px]">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${sub.color}20` }}
                            >
                              <span className="text-sm">{sub.emoji ?? "📁"}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                {sub.title}
                              </span>
                              {sub.description && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {sub.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                sub.status === "active"
                                  ? "bg-emerald-500 w-2 h-2 rounded-full"
                                  : sub.status === "paused"
                                  ? "bg-amber-500 w-2 h-2 rounded-full"
                                  : sub.status === "completed"
                                  ? "bg-primary w-2 h-2 rounded-full"
                                  : "bg-muted-foreground w-2 h-2 rounded-full"
                              }
                            />
                            <span className="text-xs capitalize text-muted-foreground">
                              {sub.status === "active"
                                ? "Ativo"
                                : sub.status === "paused"
                                ? "Pausado"
                                : sub.status === "completed"
                                ? "Concluído"
                                : "Arquivado"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 w-48">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${progressRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {progressRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                          {sub.completed_tasks}/{sub.total_tasks}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBatchRunner(sub.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all"
                              title="Testar este subprojeto com IA sem sair da tela"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Testar</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLinkPreviousReports(sub.id);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                              title="Vincular todos os relatórios e testes históricos a este subprojeto"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingle(sub.id, sub.title);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Excluir este subprojeto permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/projects/${sub.id}`);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                              title="Abrir Detalhes do Subprojeto"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleProjectCreated}
        forcedParentId={project.id}
      />

      <MultiSubprojectRunnerModal
        open={multiRunnerOpen}
        onClose={() => setMultiRunnerOpen(false)}
        subProjects={items}
        parentId={project.id}
        parentProjectTitle={project.title}
        initialSelectedIds={activeRunnerSubIds}
        initialMode={runnerInitialMode}
        onFinished={() => router.refresh()}
      />
    </div>
  );
}
