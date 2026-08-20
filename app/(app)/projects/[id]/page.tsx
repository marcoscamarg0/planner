import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ProjectEditorClient } from "./ProjectEditorClient";
import { ParentProjectClient } from "./ParentProjectClient";
import type { Task, Project, Page, AiInsight } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Projeto | Planner`,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const cleanId = decodeURIComponent(id);
  const supabase = await createClient();
  const db = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Busca projeto, páginas, subprojetos, insights e tarefas em paralelo imediato
  const [
    { data: rawProjectDirect },
    { data: rawPages },
    { data: rawSubProjects },
    { data: rawInsights },
    { data: rawTasks }
  ] = await Promise.all([
    db.from("projects").select("*").eq("id", cleanId).maybeSingle(),
    db.from("pages").select("*").eq("project_id", cleanId).order("order_index", { ascending: true }),
    db.from("projects").select("id, title, emoji, description, status, parent_id, updated_at, color").eq("parent_id", cleanId).order("created_at", { ascending: false }),
    db.from("ai_insights").select("*").eq("project_id", cleanId).order("created_at", { ascending: false }).limit(5),
    db.from("tasks").select("*").eq("project_id", cleanId).order("created_at", { ascending: false })
  ]);

  let project = rawProjectDirect as Project | null;
  if (!project) {
    // Tenta correspondência flexível buscando na lista completa
    const { data: allProjs } = await db.from("projects").select("*");
    if (allProjs && allProjs.length > 0) {
      const match = allProjs.find(
        (p: any) =>
          p.id === cleanId ||
          p.$id === cleanId ||
          String(p.id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(p.$id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(p.title || "").toLowerCase() === cleanId.toLowerCase()
      );
      if (match) {
        project = match as Project;
      }
    }
  }

  if (!project) {
    redirect("/projects");
  }

  let pages = (rawPages as Page[]) ?? [];
  const subProjects = (rawSubProjects as Project[]) ?? [];
  const insights = (rawInsights as AiInsight[]) ?? [];
  let projectTasks = (rawTasks as Task[]) ?? [];

  // Busca tarefas usando todos os IDs possíveis do projeto (id, $id, cleanId, parent_id)
  const allTargetIds = Array.from(
    new Set([
      cleanId,
      project.id,
      (project as any).$id,
      project.parent_id
    ].filter(Boolean))
  );

  if (projectTasks.length === 0 && allTargetIds.length > 0) {
    const { data: altTasks } = await db
      .from("tasks")
      .select("*")
      .in("project_id", allTargetIds)
      .order("created_at", { ascending: false });

    if (altTasks && altTasks.length > 0) {
      projectTasks = altTasks as Task[];
    }
  }

  if (pages.length === 0 && allTargetIds.length > 0) {
    const { data: altPages } = await db
      .from("pages")
      .select("*")
      .in("project_id", allTargetIds)
      .order("order_index", { ascending: true });

    if (altPages && altPages.length > 0) {
      pages = altPages as Page[];
    }
  }

  // Se for projeto pai (agrupador) com subprojetos, renderiza a visão de container
  if (!project.parent_id && subProjects.length > 0) {
    const subIds = subProjects.map((s: any) => s.id);
    let subProjectsWithStats = subProjects.map((s: any) => ({
      ...s,
      total_tasks: 0,
      completed_tasks: 0,
      pages_count: 0,
    }));

    if (subIds.length > 0) {
      const { data: subTasks } = await db
        .from("tasks")
        .select("id, project_id, status")
        .in("project_id", subIds);

      if (subTasks && subTasks.length > 0) {
        subProjectsWithStats = subProjectsWithStats.map((s: any) => {
          const sTasks = (subTasks as any[]).filter((t: any) => t.project_id === s.id && t.status !== "cancelled");
          return {
            ...s,
            total_tasks: sTasks.length,
            completed_tasks: sTasks.filter((t: any) => t.status === "done").length,
            pages_count: 0,
          };
        });
      }
    }

    return (
      <ParentProjectClient
        project={project}
        subProjects={subProjectsWithStats}
        currentUserId={user.id}
      />
    );
  }

  const firstPage = pages?.[0] ?? null;

  return (
    <ProjectEditorClient
      project={project}
      pages={pages}
      tasks={projectTasks}
      insights={insights}
      initialPage={firstPage}
      currentUserId={user.id}
    />
  );
}
