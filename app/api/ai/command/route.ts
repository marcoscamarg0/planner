import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/openrouter/client";
import { buildIntentPrompt } from "@/lib/openrouter/prompts";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { command } = await req.json();

    if (!command) {
      return NextResponse.json({ error: "Command is required" }, { status: 400 });
    }

    // Buscar os projetos do usuário
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, title")
      .eq("owner_id", user.id)
      .neq("status", "archived");

    const projectsList = projectsData || [];

    // Chamar IA para interpretar a intenção
    const messages = buildIntentPrompt(command, projectsList);
    const responseText = await callOpenRouter(messages);

    // Parse JSON
    let parsed: any;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Erro ao parsear JSON do Command Center:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const intent = parsed.intent;
    const targetProjectId = parsed.target_project_id;
    let finalProjectId = targetProjectId;
    let actionTaken = "";

    // Executar a Intenção
    if (intent === "create_project") {
      const { data: newProj } = await supabase
        .from("projects")
        .insert({
          owner_id: user.id,
          title: parsed.new_project_title || "Novo Projeto Govern",
          description: parsed.note || "",
          emoji: "🏛️"
        })
        .select()
        .single();
      
      if (newProj) finalProjectId = newProj.id;
      actionTaken = "Projeto criado com sucesso.";
    } 
    else if (intent === "delete_project" && targetProjectId) {
      await supabase
        .from("projects")
        .update({ status: "archived" })
        .eq("id", targetProjectId)
        .eq("owner_id", user.id);
      
      actionTaken = "Projeto apagado/arquivado com sucesso.";
      finalProjectId = null;
    } 
    else if (intent === "edit_project" && targetProjectId && parsed.new_project_title) {
      await supabase
        .from("projects")
        .update({ title: parsed.new_project_title })
        .eq("id", targetProjectId)
        .eq("owner_id", user.id);

      actionTaken = "Projeto renomeado com sucesso.";
    }

    // Criar tarefas se houver
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0 && finalProjectId) {
      const tasksToInsert = parsed.tasks.map((t: any) => ({
        project_id: finalProjectId,
        title: t.title || "Nova demanda",
        status: "todo",
        priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
        due_date: t.due_date || null
      }));

      await supabase.from("tasks").insert(tasksToInsert);
      actionTaken += " Demandas inseridas.";
    }

    if (!actionTaken && parsed.note) {
      actionTaken = "Comando processado sem alterações graves. Nota: " + parsed.note;
    }

    return NextResponse.json({ 
      success: true, 
      intent, 
      targetProjectId: finalProjectId, 
      actionTaken,
      raw: parsed 
    });

  } catch (error: any) {
    console.error("Command Center Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
