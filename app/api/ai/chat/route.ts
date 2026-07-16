import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Modelos 100% gratuitos no OpenRouter
const MODEL_MAP: Record<string, string> = {
  "auto-free": "openrouter/free",
  "nemotron-70b": "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "qwen-coder": "qwen/qwen-2.5-coder-32b-instruct:free",
  "laguna-xs": "poolside/laguna-xs-2.1:free",
  "cohere-north": "cohere/north-mini-code:free",
};

const DEFAULT_MODEL = "openrouter/free";

// Prompt do sistema com ações embarcadas (funciona com qualquer modelo gratuito)
function buildSystemPrompt(contextData: any): string {
  return `Você é o "Segundo Cérebro" — um assistente executivo de IA com CONTROLE TOTAL sobre a plataforma de gestão do usuário.

=== DADOS DO USUÁRIO ===
${JSON.stringify(contextData.global, null, 0)}
========================

${contextData.activeTask ? `
> [!IMPORTANT]
> === CONTEXTO DA TAREFA ATIVA ===
> O usuário ESTÁ com a seguinte tarefa ABERTA NA TELA neste exato momento:
> ${JSON.stringify(contextData.activeTask, null, 2)}
> 
> Você pode ajudá-lo a detalhar o passo a passo, entender o que fazer ou quebrar a tarefa em subtarefas. Considere isso no seu contexto se ele pedir sugestões ou perguntar algo vago como "o que faço aqui?".
> ========================
` : ''}

=== SUAS CAPACIDADES DE AÇÃO ===
Você pode realizar ações reais no sistema. Se o usuário pedir uma ação, você DEVE executá-la incluindo um bloco JSON no final da sua resposta, no formato exato:

AÇÃO:{"action":"...", "params":{...}}

Ações disponíveis:
- create_task: params={project_id, title, priority("low"|"medium"|"high"|"urgent"), description}
- update_task: params={task_id, fields:{status("todo"|"in_progress"|"done"|"cancelled"), priority, title, description}}
- delete_task: params={task_id}
- create_page: params={project_id, title}
- update_page: params={page_id, title}
- delete_page: params={page_id}
- update_project: params={project_id, fields:{title, description, status("active"|"paused"|"completed"|"archived")}}

Para MÚLTIPLAS ações, use múltiplos blocos:
AÇÃO:{"action":"create_task", "params":{...}}
AÇÃO:{"action":"create_task", "params":{...}}

REGRAS CRÍTICAS:
- Use os IDs EXATOS dos projetos/tarefas/páginas presentes nos dados acima
- Se o usuário pedir "crie uma tarefa no projeto X", encontre o project_id correto nos dados
- Se não tiver certeza do ID, pergunte ao usuário
- NUNCA diga "não posso fazer isso" — você tem permissão total
- Responda em português, de forma executiva e direta
- Formate a resposta em Markdown (antes do bloco AÇÃO:)
- O bloco AÇÃO: deve ser a ÚLTIMA coisa na sua resposta`;
}

async function callAI(messages: any[], model: string, apiKey: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://planner-j53e.onrender.com",
      "X-Title": "Planner AI",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("OpenRouter [" + response.status + "]: " + err);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function executeAction(action: string, params: any, supabase: any): Promise<string> {
  try {
    switch (action) {
      case "create_task": {
        const { error } = await supabase.from("tasks").insert({
          project_id: params.project_id,
          title: params.title,
          priority: params.priority || "medium",
          description: params.description || null,
          status: "todo",
        });
        return error ? "❌ Erro ao criar tarefa: " + error.message : "✅ Tarefa **" + params.title + "** criada!";
      }

      case "update_task": {
        const fields: any = { updated_at: new Date().toISOString() };
        if (params.fields?.status) fields.status = params.fields.status;
        if (params.fields?.priority) fields.priority = params.fields.priority;
        if (params.fields?.title) fields.title = params.fields.title;
        if (params.fields?.description !== undefined) fields.description = params.fields.description;
        const { error } = await supabase.from("tasks").update(fields).eq("id", params.task_id);
        return error ? "❌ Erro ao atualizar tarefa: " + error.message : "✅ Tarefa atualizada!";
      }

      case "delete_task": {
        const { error } = await supabase.from("tasks").delete().eq("id", params.task_id);
        return error ? "❌ Erro ao apagar tarefa: " + error.message : "🗑️ Tarefa apagada!";
      }

      case "create_page": {
        const { count } = await supabase.from("pages").select("*", { count: "exact", head: true }).eq("project_id", params.project_id);
        const { error } = await supabase.from("pages").insert({
          project_id: params.project_id,
          title: params.title,
          content: null,
          order_index: count || 0,
        });
        return error ? "❌ Erro ao criar página: " + error.message : "📄 Página **" + params.title + "** criada!";
      }

      case "update_page": {
        const { error } = await supabase.from("pages").update({ title: params.title, updated_at: new Date().toISOString() }).eq("id", params.page_id);
        return error ? "❌ Erro ao atualizar página: " + error.message : "✅ Página atualizada!";
      }

      case "delete_page": {
        const { error } = await supabase.from("pages").delete().eq("id", params.page_id);
        return error ? "❌ Erro ao apagar página: " + error.message : "🗑️ Página apagada!";
      }

      case "update_project": {
        const { error } = await supabase.from("projects").update(params.fields).eq("id", params.project_id);
        return error ? "❌ Erro ao atualizar projeto: " + error.message : "✅ Projeto atualizado!";
      }

      default:
        return "⚠️ Ação desconhecida: " + action;
    }
  } catch (e: any) {
    return "❌ Erro interno: " + e.message;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messages, model: modelKey, activeTaskId } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    // Busca contexto completo do usuário
    const [
      { data: projects },
      { data: tasks },
      { data: pages },
      { data: references }
    ] = await Promise.all([
      supabase.from("projects").select("id, title, status, description").eq("owner_id", user.id).neq("status", "archived").limit(20),
      supabase.from("tasks").select("id, title, status, priority, project_id, description").eq("status", "todo").limit(50),
      supabase.from("pages").select("id, title, project_id").limit(50),
      supabase.from("knowledge_sources").select("id, type, title, source_url, content").eq("owner_id", user.id).limit(10),
    ]);

    let activeTaskDetails = null;
    if (activeTaskId) {
      const { data: activeTask } = await supabase.from("tasks").select("*").eq("id", activeTaskId).single();
      if (activeTask) {
        // Find subtasks
        const { data: subtasks } = await supabase.from("tasks").select("id, title, status, priority").eq("parent_task_id", activeTaskId);
        activeTaskDetails = { ...activeTask, subtasks };
      }
    }

    const contextData = {
      global: {
        projects: projects ?? [],
        tasks: tasks ?? [],
        pages: pages ?? [],
        reference_sources: (references ?? []).map((r) => ({
          title: r.title,
          type: r.type,
          source_url: r.source_url,
          excerpt: (r.content || "").slice(0, 1500),
        })),
      },
      activeTask: activeTaskDetails,
    };

    const model = MODEL_MAP[modelKey] || DEFAULT_MODEL;

    const promptMessages = [
      { role: "system", content: buildSystemPrompt(contextData) },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiResponse = await callAI(promptMessages, model, apiKey);

    // Extrai e executa ações embarcadas na resposta
    const actionRegex = /AÇÃO:\s*(\{.*?\})/g;
    const actionResults: string[] = [];
    let cleanResponse = aiResponse;
    let match;

    while ((match = actionRegex.exec(aiResponse)) !== null) {
      try {
        const { action, params } = JSON.parse(match[1]);
        const result = await executeAction(action, params, supabase);
        actionResults.push(result);
      } catch (e) {
        actionResults.push("⚠️ Não foi possível processar a ação.");
      }
    }

    // Remove os blocos AÇÃO: da resposta final
    cleanResponse = aiResponse.replace(/AÇÃO:\s*\{.*?\}/g, "").trim();

    const finalReply = actionResults.length > 0
      ? actionResults.join("\n") + (cleanResponse ? "\n\n" + cleanResponse : "")
      : cleanResponse || "Sem resposta.";

    return NextResponse.json({ reply: finalReply });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
