import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectsClient } from "./ProjectsClient";

export const metadata: Metadata = {
  title: "Projetos",
  description: "Todos os seus projetos de planejamento",
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
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [
    { data: tasks },
    { data: pages },
    { data: insights }
  ] = projectIds.length > 0
    ? await Promise.all([
        supabase.from("tasks").select("id, project_id, status").in("project_id", projectIds),
        supabase.from("pages").select("id, project_id").in("project_id", projectIds),
        supabase.from("ai_insights").select("*").in("project_id", projectIds).order("created_at", { ascending: false }).limit(30)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const projectsWithStats = (projects ?? []).map((project) => {
    const projectTasks = (tasks ?? []).filter((t) => t.project_id === project.id);
    const projectPages = (pages ?? []).filter((p) => p.project_id === project.id);
    const lastInsight = (insights ?? []).find((i) => i.project_id === project.id);

    return {
      ...project,
      total_tasks: projectTasks.length,
      completed_tasks: projectTasks.filter((t) => t.status === "done").length,
      pages_count: projectPages.length,
      last_insight: lastInsight ?? null,
    };
  });

  return <ProjectsClient projectsWithStats={projectsWithStats} />;
}
