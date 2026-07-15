import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditorClient } from "./ProjectEditorClient";

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
    { data: insights }
  ] = await Promise.all([
    supabase.from("pages").select("*").eq("project_id", id).order("order_index", { ascending: true }),
    supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("ai_insights").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(5)
  ]);

  const firstPage = pages?.[0] ?? null;

  return (
    <ProjectEditorClient
      project={project}
      pages={pages ?? []}
      tasks={tasks ?? []}
      insights={insights ?? []}
      initialPage={firstPage}
    />
  );
}
