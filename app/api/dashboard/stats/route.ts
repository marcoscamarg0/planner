import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Project, Task, ProjectWithStats, AiInsight } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Busca projetos ativos/não arquivados
    const { data: rawProjects } = await supabase
      .from("projects")
      .select("id, title, description, color, emoji, status, updated_at, parent_id")
      .neq("status", "archived")
      .order("updated_at", { ascending: false });

    const userProjects = (rawProjects as Project[]) ?? [];
    const projectIds = userProjects.map((p: Project) => p.id);

    // Busca tarefas, páginas, insights e contagem de QA
    let [
      { data: rawTasks },
      { data: rawPages },
      { data: rawInsights },
      { count: qaPending }
    ] = projectIds.length > 0
      ? await Promise.all([
          supabase
            .from("tasks")
            .select("id, project_id, title, status, priority, due_date, updated_at, parent_task_id")
            .in("project_id", projectIds)
            .order("updated_at", { ascending: false }),
          supabase
            .from("pages")
            .select("id, project_id")
            .in("project_id", projectIds),
          supabase
            .from("ai_insights")
            .select("id, project_id, content, type")
            .in("project_id", projectIds)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("qa_reports")
            .select("id", { count: "exact", head: true })
            .eq("type", "test_cases"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { count: 0 }];

    const userTasks = (rawTasks as Task[]) ?? [];
    const userPages = rawPages ?? [];
    const userInsights = rawInsights ?? [];

    const projectsWithStats: ProjectWithStats[] = userProjects.map((project: Project) => {
      const subprojectIds = userProjects.filter((p: Project) => p.parent_id === project.id).map((p: Project) => p.id);
      const allIds = [project.id, ...subprojectIds];

      const projectTasks = userTasks.filter((t: Task) => allIds.includes(t.project_id) && t.status !== "cancelled");
      const projectPages = (userPages as any[]).filter((p: any) => allIds.includes(p.project_id));
      const lastInsight = (userInsights as any[]).find((i: any) => i.project_id === project.id) as AiInsight | undefined;

      const total = projectTasks.length;
      const completed = projectTasks.filter((t: Task) => t.status === "done").length;

      return {
        ...project,
        total_tasks: total,
        completed_tasks: completed,
        pages_count: projectPages.length,
        last_insight: lastInsight ?? undefined,
      };
    });

    const activeTasks = userTasks.filter((t: Task) => t.status !== "cancelled" && t.title?.trim() !== "");
    const totalTasks = activeTasks.length;
    const completedTasks = activeTasks.filter((t: Task) => t.status === "done").length;
    const pendingTasks = activeTasks.filter((t: Task) => t.status !== "done").length;

    const stats = {
      total_projects: userProjects.length,
      active_projects: userProjects.filter((p: Project) => p.status === "active").length,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      pending_tasks: pendingTasks,
      completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      qa_pending: qaPending ?? 0,
    };

    return NextResponse.json({
      projectsWithStats,
      allTasks: userTasks,
      stats,
      success: true,
    });
  } catch (err: any) {
    console.error("[/api/dashboard/stats] Error:", err.message);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
