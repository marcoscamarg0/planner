import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectsClient } from "./ProjectsClient";
import type { Project, Task, ProjectWithStats, AiInsight } from "@/types";

export const metadata = {
  title: "Projetos | Planner",
  description: "Gerencie seus projetos e entregas institucionais",
};

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: rawProjects } = await supabase
    .from("projects")
    .select("id, title, description, color, emoji, status, parent_id, updated_at")
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  let userProjects = (rawProjects as Project[]) ?? [];

  // Fallback com Service Role se necessário
  if (userProjects.length === 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = await createServiceClient();
      const { data: adminProjects } = await admin
        .from("projects")
        .select("id, title, description, color, emoji, status, parent_id, updated_at")
        .neq("status", "archived")
        .order("updated_at", { ascending: false });
      if (adminProjects && adminProjects.length > 0) {
        userProjects = adminProjects as Project[];
      }
    } catch {}
  }

  const projectIds = userProjects.map((p: Project) => p.id);

  let [
    { data: tasks },
    { data: pages },
    { data: insights }
  ] = projectIds.length > 0
    ? await Promise.all([
        supabase.from("tasks").select("id, project_id, title, status").in("project_id", projectIds),
        supabase.from("pages").select("id, project_id").in("project_id", projectIds),
        supabase.from("ai_insights").select("id, project_id, content, type").in("project_id", projectIds).order("created_at", { ascending: false }).limit(10)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  let userTasks = (tasks as Task[]) ?? [];
  let userPages = (pages as any[]) ?? [];
  let userInsights = (insights as any[]) ?? [];

  // Fallback de Service Role para tarefas
  if (userTasks.length === 0 && projectIds.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = await createServiceClient();
      const { data: adminTasks } = await admin
        .from("tasks")
        .select("id, project_id, title, status")
        .in("project_id", projectIds);
      if (adminTasks && adminTasks.length > 0) {
        userTasks = adminTasks as Task[];
      }
    } catch {}
  }

  const projectsWithStats: ProjectWithStats[] = userProjects.map((project: Project) => {
    const subprojectIds = userProjects.filter((p: Project) => p.parent_id === project.id).map((p: Project) => p.id);
    const allIds = [project.id, ...subprojectIds];

    const projectTasks = userTasks.filter(
      (t: Task) => allIds.includes(t.project_id) && t.status !== "cancelled" && t.title?.trim() !== ""
    );
    const projectPages = (userPages as any[]).filter((p: any) => allIds.includes(p.project_id));
    const lastInsight = (userInsights as any[]).find((i: any) => i.project_id === project.id) as AiInsight | undefined;

    return {
      ...project,
      total_tasks: projectTasks.length,
      completed_tasks: projectTasks.filter((t: Task) => t.status === "done").length,
      pages_count: projectPages.length,
      last_insight: lastInsight ?? undefined,
    };
  });

  return <ProjectsClient initialProjects={projectsWithStats} currentUserId={user.id} />;
}
