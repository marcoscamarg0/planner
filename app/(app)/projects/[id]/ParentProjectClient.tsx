"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, Network, ArrowLeft, ArrowRight } from "lucide-react";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import type { Project, ProjectWithStats } from "@/types";

interface ParentProjectClientProps {
  project: Project;
  subProjects: ProjectWithStats[];
  currentUserId: string;
}

export function ParentProjectClient({ project, subProjects, currentUserId }: ParentProjectClientProps) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const router = useRouter();

  const handleProjectCreated = (newProject: Project) => {
    setNewProjectOpen(false);
    router.refresh();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background/50 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {project.description || "Projeto mãe/agrupador."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo subprojeto
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Network className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-primary">Projeto Mãe (Agrupador)</h3>
              <p className="text-sm text-primary/80 mt-1">
                Este projeto é a raiz (nível mais alto) e serve apenas para agrupar outros subprojetos.
                Você não pode criar tarefas ou rodar testes diretamente aqui. Clique em um subprojeto abaixo para gerenciá-lo.
              </p>
            </div>
          </div>
        </div>

        {/* Subprojects Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            Subprojetos
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {subProjects.length}
            </span>
          </h2>

          {subProjects.length === 0 ? (
            <div className="glass rounded-2xl p-16 text-center border-dashed border-2 border-border/50">
              <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium text-foreground mb-1">
                Nenhum subprojeto criado
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Crie um subprojeto para começar a gerenciar tarefas e relatórios.
              </p>
              <button
                onClick={() => setNewProjectOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Subprojeto
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground text-xs font-medium border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Subprojeto</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Progresso</th>
                    <th className="px-4 py-3 font-medium text-center">Tarefas</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subProjects.map((sub, index) => {
                    const progressRate = sub.total_tasks > 0
                      ? Math.round((sub.completed_tasks / sub.total_tasks) * 100)
                      : 0;

                    return (
                      <tr 
                        key={sub.id}
                        className="group transition-colors hover:bg-accent/50"
                      >
                        <td className="px-4 py-3 min-w-[200px] max-w-[300px]">
                          <div 
                            onClick={() => router.push(`/projects/${sub.id}`)} 
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${sub.color}20` }}>
                              <span className="text-sm">{sub.emoji ?? "📁"}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-foreground truncate">{sub.title}</span>
                              {sub.description && (
                                <span className="text-xs text-muted-foreground truncate">{sub.description}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={
                              sub.status === "active" ? "bg-emerald-500 w-2 h-2 rounded-full" :
                              sub.status === "paused" ? "bg-amber-500 w-2 h-2 rounded-full" :
                              sub.status === "completed" ? "bg-primary w-2 h-2 rounded-full" : "bg-muted-foreground w-2 h-2 rounded-full"
                            } />
                            <span className="text-xs capitalize text-muted-foreground">
                              {sub.status === "active" ? "Ativo" :
                               sub.status === "paused" ? "Pausado" :
                               sub.status === "completed" ? "Concluído" : "Arquivado"}
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
                            <span className="text-xs text-muted-foreground w-8 text-right">{progressRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                          {sub.completed_tasks}/{sub.total_tasks}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => router.push(`/projects/${sub.id}`)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border transition-all"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
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
    </div>
  );
}
