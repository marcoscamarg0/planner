"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, Network, ArrowLeft } from "lucide-react";
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {subProjects.map((subProject, i) => (
                <ProjectCard
                  key={subProject.id}
                  project={subProject}
                  subProjects={[]} // They don't have further nesting displayed here usually
                  index={i}
                  currentUserId={currentUserId}
                />
              ))}
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
