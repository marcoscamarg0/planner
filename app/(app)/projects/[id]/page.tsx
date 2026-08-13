import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditorClient } from "./ProjectEditorClient";
import { ParentProjectClient } from "./ParentProjectClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", id)
    .single();

  return {
    title: project?.title ?? "Projeto",
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const [
    { data: pages },
    { data: tasks },
    { data: insights },
    { data: subProjects }
  ] = await Promise.all([
    supabase.from("pages").select("*").eq("project_id", id).order("order_index", { ascending: true }),
    supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("ai_insights").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("projects").select("*").eq("parent_id", id).order("created_at", { ascending: false })
  ]);

  // If this is a root project (no parent_id), render the parent container view
  if (!project.parent_id) {
    // Enrich each subproject with task stats
    const subIds = (subProjects ?? []).map((s) => s.id);
    let subProjectsWithStats = (subProjects ?? []).map((s) => ({
      ...s,
      total_tasks: 0,
      completed_tasks: 0,
      pages_count: 0,
    }));

    if (subIds.length > 0) {
      const { data: subTasks } = await supabase
        .from("tasks")
        .select("id, project_id, status")
        .in("project_id", subIds);

      if (subTasks && subTasks.length > 0) {
        subProjectsWithStats = subProjectsWithStats.map((s) => {
          const projectTasks = subTasks.filter((t) => t.project_id === s.id && t.status !== "cancelled");
          return {
            ...s,
            total_tasks: projectTasks.length,
            completed_tasks: projectTasks.filter((t) => t.status === "done").length,
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
      pages={pages ?? []}
      tasks={tasks ?? []}
      insights={insights ?? []}
      initialPage={firstPage}
      currentUserId={user.id}
    />
  );
}
