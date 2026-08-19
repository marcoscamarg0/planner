import { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import type { Task, Profile, Project, ProjectWithStats, AiInsight } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard | Planner",
  description: "Visão geral dos seus projetos e tarefas",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Busca dados iniciais
  let [
    { data: rawProfile },
    { data: rawProjects },
    { count: qaPending }
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, description, color, emoji, status, updated_at, parent_id")
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    supabase
      .from("qa_reports")
      .select("id", { count: "exact", head: true })
      .eq("type", "test_cases")
  ]);

  let profile = rawProfile as Profile | null;
  let userProjects = (rawProjects as Project[]) ?? [];

  // Fallback com Service Role se necessário
  if ((!profile || userProjects.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = await createServiceClient();
      const [adminProfRes, adminProjRes] = await Promise.all([
        !profile ? admin.from("profiles").select("id, full_name, email, avatar_url, role").eq("id", user.id).maybeSingle() : Promise.resolve({ data: profile }),
        userProjects.length === 0 ? admin.from("projects").select("id, title, description, color, emoji, status, updated_at, parent_id").neq("status", "archived").order("updated_at", { ascending: false }) : Promise.resolve({ data: userProjects })
      ]);
      if (adminProfRes.data) profile = adminProfRes.data as Profile;
      if (adminProjRes.data && adminProjRes.data.length > 0) userProjects = adminProjRes.data as Project[];
    } catch {}
  }

  const safeProfile: Profile = profile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name: ((user.user_metadata as any)?.full_name as string) || (user.email ? user.email.split("@")[0] : "Usuário"),
    avatar_url: ((user.user_metadata as any)?.avatar_url as string) || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const projectIds = userProjects.map((p: Project) => p.id);

  // Busca tarefas, páginas e insights
  let [
    { data: tasks },
    { data: pages },
    { data: insights }
  ] = projectIds.length > 0
    ? await Promise.all([
        supabase
          .from("tasks")
          .select("id, project_id, title, status, priority, due_date, updated_at, parent_task_id")
          .in("project_id", projectIds),
        supabase
          .from("pages")
          .select("id, project_id")
          .in("project_id", projectIds),
        supabase
          .from("ai_insights")
          .select("id, project_id, content, type")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(10)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  let userTasks = (tasks as Task[]) ?? [];
  let userPages = (pages as any[]) ?? [];
  let userInsights = (insights as any[]) ?? [];

  // Fallback de Service Role para tarefas caso o usuário não tenha permissão RLS direta
  if (userTasks.length === 0 && projectIds.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = await createServiceClient();
      const { data: adminTasks } = await admin
        .from("tasks")
        .select("id, project_id, title, status, priority, due_date, updated_at, parent_task_id")
        .in("project_id", projectIds);
      if (adminTasks && adminTasks.length > 0) {
        userTasks = adminTasks as Task[];
      }
    } catch {}
  }

  const projectsWithStats: ProjectWithStats[] = userProjects.map((project: Project) => {
    const subprojectIds = userProjects.filter((p: Project) => p.parent_id === project.id).map((p: Project) => p.id);
    const allIds = [project.id, ...subprojectIds];

    const projectTasks = userTasks.filter((t: Task) => allIds.includes(t.project_id) && t.status !== "cancelled");
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

  const parentTasks = userTasks.filter((t: Task) => !t.parent_task_id && t.status !== "cancelled" && t.title?.trim() !== "");
  const totalTasks = parentTasks.length > 0 ? parentTasks.length : userTasks.filter((t: Task) => t.status !== "cancelled").length;
  const completedTasks = userTasks.filter((t: Task) => t.status === "done").length;

  const stats = {
    total_projects: userProjects.length,
    active_projects: userProjects.filter((p: Project) => p.status === "active").length,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    qa_pending: qaPending ?? 0,
  };

  return (
    <DashboardClient
      profile={safeProfile}
      projectsWithStats={projectsWithStats}
      allTasks={userTasks}
      stats={stats}
    />
  );
}
