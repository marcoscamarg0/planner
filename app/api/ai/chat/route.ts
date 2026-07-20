import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromPdfBuffer } from "@/lib/knowledge/extract";

export const runtime = "nodejs";

// Modelos gratuitos no OpenRouter
const MODEL_MAP: Record<string, string> = {
  "auto-free": "openrouter/free",
  "kimi-k2": "google/gemini-2.0-flash-exp:free",
  "nemotron-70b": "nvidia/nemotron-3-super-120b-a12b:free",
  "nemotron-super": "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen-coder": "qwen/qwen-2.5-coder-32b-instruct:free",
  "laguna-xs": "poolside/laguna-xs-2.1:free",
  "gpt-oss": "openai/gpt-oss-20b:free",
  "cohere-north": "cohere/north-mini-code:free",
};

const DEFAULT_MODEL = "openrouter/free";

function buildSystemPrompt(contextData: any): string {
  return `Você é o "Segundo Cérebro" — um assistente executivo de IA com CONTROLE TOTAL sobre a plataforma de gestão do usuário.

=== IDENTIDADE E COMPORTAMENTO ===
- Você é PROATIVO, ORGANIZADO e ESTRUTURADO
- Quando o usuário compartilhar um documento (HTML ou PDF), você DEVE analisá-lo em profundidade
- Quando sugerido organizar tarefas, você SEMPRE cria a tarefa principal E suas subtarefas automaticamente
- Formate respostas com Markdown rico: use **negrito**, listas, cabeçalhos e separadores
- Seja conciso mas completo — sem enrolação

=== DADOS DO USUÁRIO ===
${JSON.stringify(contextData.global, null, 0)}
========================

${contextData.activeTask ? `
=== TAREFA ATIVA NA TELA ===
O usuário está com esta tarefa aberta:
${JSON.stringify(contextData.activeTask, null, 2)}

Você pode quebrar esta tarefa em subtarefas. Ao criar subtarefas, use parent_task_id com o ID acima.
===========================
` : ""}

${contextData.attachmentContext ? `
=== DOCUMENTO ANEXADO PELO USUÁRIO ===
Tipo: ${contextData.attachmentContext.type}
Nome: ${contextData.attachmentContext.name}
Conteúdo:
${contextData.attachmentContext.content}
=====================================
Analise o documento acima e responda considerando seu conteúdo completo.
` : ""}

=== AÇÕES DISPONÍVEIS ===
Você pode executar ações REAIS. Use blocos AÇÃO: no FINAL da sua resposta.

AÇÃO:{"action":"nome", "params":{...}}

Ações:
- create_task: params={project_id, title, priority("low"|"medium"|"high"|"urgent"), description}
- create_subtask: params={project_id, parent_task_id, title, priority("low"|"medium"|"high"|"urgent"), description}
- update_task: params={task_id, fields:{status("todo"|"in_progress"|"done"|"cancelled"), priority, title, description}}
- delete_task: params={task_id}
- create_page: params={project_id, title}
- update_page: params={page_id, title}
- delete_page: params={page_id}
- update_project: params={project_id, fields:{title, description, status("active"|"paused"|"completed"|"archived")}}

Para criar uma tarefa COM subtarefas, use múltiplos blocos em sequência:
AÇÃO:{"action":"create_task", "params":{"project_id":"...", "title":"Tarefa Principal", "priority":"high", "description":"..."}}
AÇÃO:{"action":"create_subtask", "params":{"project_id":"...", "parent_task_id":"PARENT_ID_GERADO", "title":"Subtarefa 1", "priority":"medium", "description":"..."}}

ATENÇÃO: Para subtarefas de uma tarefa RECÉM criada no mesmo turno, use o placeholder "LAST_TASK_ID" no parent_task_id.

=== REGRAS CRÍTICAS ===
- Use IDs EXATOS dos projetos/tarefas presentes nos dados
- Ao organizar ideias do documento anexado → crie tarefas e subtarefas estruturadas no projeto correto
- Quando o usuário pedir "organize", "planeje" ou "quebre em tarefas" → crie TODAS as subtarefas de uma vez
- Cada subtarefa deve ter uma descrição detalhada e clara
- NUNCA diga "não posso" — você tem permissão total
- Responda em português
- Blocos AÇÃO: sempre ao final`;
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
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("OpenRouter [" + response.status + "]: " + err);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function executeAction(
  action: string,
  params: any,
  supabase: any,
  lastTaskId?: string
): Promise<{ result: string; newTaskId?: string }> {
  // Replace placeholder for last created task
  if (params.parent_task_id === "LAST_TASK_ID" && lastTaskId) {
    params.parent_task_id = lastTaskId;
  }

  try {
    switch (action) {
      case "create_task": {
        const { data, error } = await supabase.from("tasks").insert({
          project_id: params.project_id,
          title: params.title,
          priority: params.priority || "medium",
          description: params.description || null,
          status: "todo",
        }).select("id").single();

        if (error) return { result: "❌ Erro ao criar tarefa: " + error.message };
        return {
          result: "✅ Tarefa **" + params.title + "** criada!",
          newTaskId: data?.id,
        };
      }

      case "create_subtask": {
        const { error } = await supabase.from("tasks").insert({
          project_id: params.project_id,
          parent_task_id: params.parent_task_id,
          title: params.title,
          priority: params.priority || "medium",
          description: params.description || null,
          status: "todo",
        });
        return {
          result: error
            ? "❌ Erro ao criar subtarefa: " + error.message
            : "  ↳ ✅ Subtarefa **" + params.title + "** criada!",
        };
      }

      case "update_task": {
        const fields: any = { updated_at: new Date().toISOString() };
        if (params.fields?.status) fields.status = params.fields.status;
        if (params.fields?.priority) fields.priority = params.fields.priority;
        if (params.fields?.title) fields.title = params.fields.title;
        if (params.fields?.description !== undefined) fields.description = params.fields.description;
        const { error } = await supabase.from("tasks").update(fields).eq("id", params.task_id);
        return { result: error ? "❌ Erro ao atualizar tarefa: " + error.message : "✅ Tarefa atualizada!" };
      }

      case "delete_task": {
        const { error } = await supabase.from("tasks").delete().eq("id", params.task_id);
        return { result: error ? "❌ Erro ao apagar tarefa: " + error.message : "🗑️ Tarefa apagada!" };
      }

      case "create_page": {
        const { count } = await supabase.from("pages").select("*", { count: "exact", head: true }).eq("project_id", params.project_id);
        const { error } = await supabase.from("pages").insert({
          project_id: params.project_id,
          title: params.title,
          content: null,
          order_index: count || 0,
        });
        return { result: error ? "❌ Erro ao criar página: " + error.message : "📄 Página **" + params.title + "** criada!" };
      }

      case "update_page": {
        const { error } = await supabase.from("pages").update({ title: params.title, updated_at: new Date().toISOString() }).eq("id", params.page_id);
        return { result: error ? "❌ Erro ao atualizar página: " + error.message : "✅ Página atualizada!" };
      }

      case "delete_page": {
        const { error } = await supabase.from("pages").delete().eq("id", params.page_id);
        return { result: error ? "❌ Erro ao apagar página: " + error.message : "🗑️ Página apagada!" };
      }

      case "update_project": {
        const { error } = await supabase.from("projects").update(params.fields).eq("id", params.project_id);
        return { result: error ? "❌ Erro ao atualizar projeto: " + error.message : "✅ Projeto atualizado!" };
      }

      default:
        return { result: "⚠️ Ação desconhecida: " + action };
    }
  } catch (e: any) {
    return { result: "❌ Erro interno: " + e.message };
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    let messages: any[], modelKey: string, activeTaskId: string | null;
    let attachmentContext: { type: string; name: string; content: string } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      messages = JSON.parse(form.get("messages") as string);
      modelKey = form.get("model") as string || "auto-free";
      activeTaskId = form.get("activeTaskId") as string || null;

      const file = form.get("file") as File | null;
      if (file) {
        const isHtml = file.name.endsWith(".html") || file.name.endsWith(".htm") || file.type === "text/html";
        const isPdf = file.name.endsWith(".pdf") || file.type === "application/pdf";

        if (isHtml) {
          const text = await file.text();
          // Strip HTML tags for cleaner context
          const stripped = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          attachmentContext = {
            type: "HTML",
            name: file.name,
            content: stripped.slice(0, 10000),
          };
        } else if (isPdf) {
          const arrayBuffer = await file.arrayBuffer();
          const text = await extractFromPdfBuffer(Buffer.from(arrayBuffer));
          attachmentContext = {
            type: "PDF",
            name: file.name,
            content: (text || "Não foi possível extrair texto deste PDF.").slice(0, 10000),
          };
        }
      }
    } else {
      const body = await req.json();
      messages = body.messages;
      modelKey = body.model;
      activeTaskId = body.activeTaskId;
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    const [
      { data: projects },
      { data: tasks },
      { data: pages },
      { data: references }
    ] = await Promise.all([
      supabase.from("projects").select("id, title, status, description").eq("owner_id", user.id).neq("status", "archived").limit(20),
      supabase.from("tasks").select("id, title, status, priority, project_id, description, parent_task_id").limit(60),
      supabase.from("pages").select("id, title, project_id").limit(50),
      supabase.from("knowledge_sources").select("id, type, title, source_url, content").eq("owner_id", user.id).limit(15),
    ]);

    let activeTaskDetails = null;
    if (activeTaskId) {
      const { data: activeTask } = await supabase.from("tasks").select("*").eq("id", activeTaskId).single();
      if (activeTask) {
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
      attachmentContext,
    };

    const model = MODEL_MAP[modelKey] || DEFAULT_MODEL;

    const promptMessages = [
      { role: "system", content: buildSystemPrompt(contextData) },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiResponse = await callAI(promptMessages, model, apiKey);

    // Parse and execute all AÇÃO: blocks, threading last task ID for subtasks
    const actionRegex = /AÇÃO:\s*(\{[\s\S]*?\})/g;
    const actionResults: string[] = [];
    let cleanResponse = aiResponse;
    let match;
    let lastTaskId: string | undefined;

    while ((match = actionRegex.exec(aiResponse)) !== null) {
      try {
        const { action, params } = JSON.parse(match[1]);
        const { result, newTaskId } = await executeAction(action, params, supabase, lastTaskId);
        actionResults.push(result);
        if (newTaskId) lastTaskId = newTaskId;
      } catch (e) {
        actionResults.push("⚠️ Não foi possível processar a ação.");
      }
    }

    cleanResponse = aiResponse.replace(/AÇÃO:\s*\{[\s\S]*?\}/g, "").trim();

    const finalReply = actionResults.length > 0
      ? actionResults.join("\n") + (cleanResponse ? "\n\n" + cleanResponse : "")
      : cleanResponse || "Sem resposta.";

    return NextResponse.json({ reply: finalReply });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
