import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServiceClient();
    
    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id, title, parent_id, status, created_at");

    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, project_id, status, parent_task_id, created_at");

    const { data: reports, error: rErr } = await supabase
      .from("qa_reports")
      .select("id, title, project_id, type, created_at");

    return NextResponse.json({
      success: true,
      projectsCount: projects?.length || 0,
      tasksCount: tasks?.length || 0,
      reportsCount: reports?.length || 0,
      projects: projects || [],
      tasks: tasks || [],
      reports: reports || [],
      errors: { pErr, tErr, rErr }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
