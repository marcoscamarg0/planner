import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Buscar tarefas que têm due_date menor ou igual a (hoje + 2 dias) e status != 'done'
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + 2);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, status, projects(id, title, color)")
      .not("due_date", "is", null)
      .neq("status", "done")
      .lte("due_date", limitDate.toISOString())
      .order("due_date", { ascending: true });

    return NextResponse.json({ notifications: tasks || [] });
  } catch (error) {
    console.error("Notifications API Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
