import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: tasks, error } = await supabase.from("tasks").select("*");
  if (error) return NextResponse.json({ error });
  
  // Return tasks that are not done and not cancelled
  const pendingTasks = (tasks || []).filter(t => t.status !== "done" && t.status !== "cancelled");
  
  return NextResponse.json({ 
    total: tasks?.length,
    pendingCount: pendingTasks.length,
    pendingTasks 
  });
}
