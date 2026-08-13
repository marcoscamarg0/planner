import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectsClient } from "./ProjectsClient";

export const metadata = {
  title: "Projetos | Planner",
  description: "Gerencie seus projetos",
};

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [
    { data: tasks },
    { data: pages },
    { data: insights }
  ] = projectIds.length > 0
    ? await Promise.all([
        supabase.from("tasks").select("*").in("project_id", projectIds),
        supabase.from("pages").select("id, project_id").in("project_id", projectIds),
        supabase.from("ai_insights").select("*").in("project_id", projectIds).order("created_at", { ascending: false }).limit(30)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const projectsWithStats = (projects ?? []).map((project) => {
    const subprojectIds = (projects ?? []).filter((p) => p.parent_id === project.id).map((p) => p.id);
    const allIds = [project.id, ...subprojectIds];

    const projectTasks = (tasks ?? []).filter(
      (t) => allIds.includes(t.project_id) && t.status !== "cancelled" && t.title?.trim() !== "" && !t.title?.startsWith("[QA]") && !t.parent_task_id
    );
    const projectPages = (pages ?? []).filter((p) => allIds.includes(p.project_id));
    const lastInsight = (insights ?? []).find((i) => i.project_id === project.id);

    return {
      ...project,
      total_tasks: projectTasks.length,
      completed_tasks: projectTasks.filter((t) => t.status === "done").length,
      pages_count: projectPages.length,
      last_insight: lastInsight ?? null,
    };
  });

  return <ProjectsClient projectsWithStats={projectsWithStats} userId={user.id} />;
}
