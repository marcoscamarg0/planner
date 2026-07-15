import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportClient } from "./ReportClient";

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

  return { title: `Relatório — ${project?.title ?? "Projeto"}` };
}

export default async function ReportPage({ params }: Props) {
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

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const { data: insights } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, created_at, updated_at")
    .eq("project_id", id);

  return (
    <ReportClient
      project={project}
      tasks={tasks ?? []}
      insights={insights ?? []}
      pages={pages ?? []}
    />
  );
}
