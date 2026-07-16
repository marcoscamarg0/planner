import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskTitle, projectTitle } = await req.json();

    if (!taskTitle) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    const model = process.env.OPENROUTER_MODEL_CHAT || "openrouter/free";

    const sysPrompt =
      "Voce e um especialista em planejamento estrategico governamental. " +
      "Seu objetivo e gerar um passo a passo detalhado e pratico de como executar a tarefa solicitada. " +
      "Responda APENAS com o passo a passo em formato Markdown. " +
      "Nao adicione introducoes ou conclusoes desnecessarias. Seja direto, executivo e estruturado.";

    const userPrompt =
      "Projeto: " + (projectTitle || "Nao especificado") +
      "\nTarefa: " + taskTitle +
      "\n\nEscreva um plano de acao detalhado (passo a passo) para executar esta demanda.";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + openRouterApiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Governo AI Planner",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Falha na IA" }, { status: 500 });
    }

    const data = await response.json();
    const plan = data.choices[0]?.message?.content || "Nao foi possivel gerar o plano.";

    return NextResponse.json({ plan });

  } catch (error: any) {
    console.error("Task Plan Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
