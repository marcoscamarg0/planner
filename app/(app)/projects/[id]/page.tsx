import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ProjectEditorClient } from "./ProjectEditorClient";
import { ParentProjectClient } from "./ParentProjectClient";
import type { Task, Project, Page, AiInsight } from "@/types";

export const dynamic = "force-dynamic";

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

  // Autenticação com proteção contra hang
  const userPromise = supabase.auth.getUser();
  const timeoutPromise = new Promise<{ data: { user: any } }>((resolve) =>
    setTimeout(() => resolve({ data: { user: null } }), 1500)
  );
  const { data: { user } } = await Promise.race([userPromise, timeoutPromise]);

  if (!user) {
    redirect("/login");
  }

  // Usa Service Role para queries de alta performance e sem bloqueios de RLS quando disponível
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createServiceClient() : supabase;

  // Busca projeto, páginas, subprojetos, insights e tarefas em paralelo imediato (Zero Waterfall)
  const [
    { data: rawProject },
    { data: rawPages },
    { data: rawSubProjects },
    { data: rawInsights },
    { data: rawTasks }
  ] = await Promise.all([
    db.from("projects").select("*").eq("id", cleanId).maybeSingle(),
    db.from("pages").select("*").eq("project_id", cleanId).order("order_index", { ascending: true }),
    db.from("projects").select("id, title, emoji, description, status, parent_id, updated_at").eq("parent_id", cleanId).order("created_at", { ascending: false }),
    db.from("ai_insights").select("*").eq("project_id", cleanId).order("created_at", { ascending: false }).limit(5),
    db.from("tasks").select("*").eq("project_id", cleanId).order("created_at", { ascending: false })
  ]);

  let project = rawProject as Project | null;
  if (!project) {
    // Tenta correspondência flexível (case-insensitive ou primeiro projeto disponível)
    const { data: allProjs } = await db.from("projects").select("*").neq("status", "archived");
    if (allProjs && allProjs.length > 0) {
      const match = allProjs.find(
        (p: any) =>
          p.id === cleanId ||
          p.$id === cleanId ||
          String(p.title || "").toLowerCase() === cleanId.toLowerCase() ||
          String(p.id || "").toLowerCase() === cleanId.toLowerCase()
      );
      if (match) {
        project = match as Project;
      } else {
        // Redireciona para a lista de projetos em vez de 404
        redirect("/projects");
      }
    } else {
      redirect("/projects");
    }
  }

  const pages = (rawPages as Page[]) ?? [];
  const subProjects = (rawSubProjects as Project[]) ?? [];
  const insights = (rawInsights as AiInsight[]) ?? [];
  let projectTasks = (rawTasks as Task[]) ?? [];

  // Se o projeto for subprojeto e não tiver tarefas próprias diretas, busca as tarefas herdadas
  if (projectTasks.length === 0 && project.parent_id) {
    const { data: parentTasks } = await db
      .from("tasks")
      .select("*")
      .eq("project_id", project.parent_id)
      .order("created_at", { ascending: false });

    if (parentTasks && parentTasks.length > 0) {
      projectTasks = parentTasks as Task[];
    }
  }

  // Se for projeto pai (agrupador) com subprojetos, renderiza a visão de container
  if (!project.parent_id && subProjects.length > 0) {
    const subIds = subProjects.map((s) => s.id);
    let subProjectsWithStats = subProjects.map((s) => ({
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
        subProjectsWithStats = subProjectsWithStats.map((s) => {
          const sTasks = subTasks.filter((t) => t.project_id === s.id && t.status !== "cancelled");
          return {
            ...s,
            total_tasks: sTasks.length,
            completed_tasks: sTasks.filter((t) => t.status === "done").length,
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
