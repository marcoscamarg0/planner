import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    let supabase = await createClient();
    let { data: projects } = await supabase.from("projects").select("id, title, parent_id");
    let { data: tasks } = await supabase.from("tasks").select("id, title, project_id, status, parent_task_id");

    if (!tasks || tasks.length === 0) {
      const admin = await createServiceClient();
      const resProj = await admin.from("projects").select("id, title, parent_id");
      const resTasks = await admin.from("tasks").select("id, title, project_id, status, parent_task_id");
      projects = resProj.data;
      tasks = resTasks.data;
    }

    return NextResponse.json({
      projects: projects || [],
      tasksCount: tasks?.length || 0,
      tasks: tasks || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
