import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildChatPrompt } from "@/lib/openrouter/prompts";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, model: modelKey } = await req.json();

    const MODEL_MAP: Record<string, string> = {
      "llama-3.1-8b": "meta-llama/llama-3.1-8b-instruct",
      "gemini-flash": "google/gemini-flash-1.5",
      "mistral-7b": "mistralai/mistral-7b-instruct",
      "claude-haiku": "anthropic/claude-3-haiku",
      "gpt-4o-mini": "openai/gpt-4o-mini",
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    // Busca Contexto (RAG - Retrieval Augmented Generation)
    const [
      { data: projects },
      { data: tasks },
      { data: references }
    ] = await Promise.all([
      supabase.from("projects").select("id, title, status, description").eq("owner_id", user.id).neq("status", "archived").limit(10),
      supabase.from("tasks").select("title, status, priority, due_date, project_id").neq("status", "done").order("due_date", { ascending: true }).limit(20),
      supabase.from("knowledge_sources").select("id, type, title, source_url, content").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(12)
    ]);

    const contextData = {
      projects: projects ?? [],
      pending_tasks: tasks ?? [],
      // Referências anexadas pelo usuário (links, PDFs, textos) — conteúdo truncado por fonte
      reference_sources: (references ?? []).map((r) => ({
        title: r.title,
        type: r.type,
        source_url: r.source_url,
        excerpt: (r.content || "").slice(0, 2500),
      })),
    };

    const promptMessages = buildChatPrompt(messages, contextData);

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    // Model: prefer the one sent from frontend, then env var, then default
    const model = MODEL_MAP[modelKey] || process.env.OPENROUTER_MODEL_CHAT || "meta-llama/llama-3.1-8b-instruct";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Governo AI Planner",
      },
      body: JSON.stringify({
        model: model,
        messages: promptMessages,
        temperature: 0.3,
        tools: [
          {
            type: "function",
            function: {
              name: "create_task",
              description: "Cria uma nova demanda/tarefa em um projeto do usuário.",
              parameters: {
                type: "object",
                properties: {
                  project_id: { type: "string", description: "O ID (UUID) do projeto alvo" },
                  title: { type: "string", description: "O título da tarefa" },
                  priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                  description: { type: "string", description: "Observações ou detalhes da tarefa" }
                },
                required: ["project_id", "title"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_page",
              description: "Cria um novo documento/página em um projeto do usuário.",
              parameters: {
                type: "object",
                properties: {
                  project_id: { type: "string", description: "O ID (UUID) do projeto alvo" },
                  title: { type: "string", description: "O título da página" }
                },
                required: ["project_id", "title"]
              }
            }
          }
        ]
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Falha na IA" }, { status: 500 });
    }

    const data = await response.json();
    const message = data.choices[0]?.message;

    if (message?.tool_calls?.length > 0) {
      let toolsFeedback = "";
      for (const call of message.tool_calls) {
        if (call.function.name === "create_task") {
          try {
            const args = JSON.parse(call.function.arguments);
            const { error } = await supabase
              .from("tasks")
              .insert({
                project_id: args.project_id,
                title: args.title,
                priority: args.priority || "medium",
                description: args.description || null,
                status: "todo",
              });
              
            if (error) {
              toolsFeedback += `Erro ao criar tarefa "${args.title}": ${error.message}\n`;
            } else {
              toolsFeedback += `✅ Tarefa **${args.title}** criada com sucesso!\n`;
            }
          } catch (e) {
            toolsFeedback += `Erro ao processar criação da tarefa.\n`;
          }
        } else if (call.function.name === "create_page") {
          try {
            const args = JSON.parse(call.function.arguments);
            // Busca a contagem atual para order_index
            const { count } = await supabase.from("pages").select("*", { count: 'exact', head: true }).eq("project_id", args.project_id);
            const { error } = await supabase
              .from("pages")
              .insert({
                project_id: args.project_id,
                title: args.title,
                content: null,
                order_index: count || 0,
              });
              
            if (error) {
              toolsFeedback += `Erro ao criar página "${args.title}": ${error.message}\n`;
            } else {
              toolsFeedback += `📄 Página **${args.title}** criada com sucesso!\n`;
            }
          } catch (e) {
            toolsFeedback += `Erro ao processar criação da página.\n`;
          }
        }
      }
      return NextResponse.json({ reply: toolsFeedback + (message.content ? "\n\n" + message.content : "") });
    }

    const reply = message?.content || "Sem resposta.";
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
