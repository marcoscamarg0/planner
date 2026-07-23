import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AVAILABLE_MODELS: Record<string, string> = {
  "auto-free": "openrouter/free",
  "kimi-k2": "google/gemini-2.0-flash-exp:free",
  "nemotron-70b": "nvidia/nemotron-3-super-120b-a12b:free",
  "nemotron-super": "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen-coder": "qwen/qwen-2.5-coder-32b-instruct:free",
  "laguna-xs": "poolside/laguna-xs-2.1:free",
  "gpt-oss": "openai/gpt-oss-20b:free",
  "cohere-north": "cohere/north-mini-code:free",
};

async function callOpenRouter(messages: any[], modelKey: string, apiKey: string) {
  const model = AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS["auto-free"];
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://planner-j53e.onrender.com",
      "X-Title": "Planner QA Suite",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 4000 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("OpenRouter error [" + response.status + "]: " + err);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("qa_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ reports: data ?? [] });
  } catch (error: any) {
    console.error("[GET /api/ai/qa] Erro no histórico:", error);
    return NextResponse.json({ error: error?.message || "Erro desconhecido" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, result_json, result_raw } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("qa_reports")
      .update({ result_json, result_raw })
      .eq("id", id)
      .eq("user_id", user.id)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, report: data?.[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    let tool_type: string, input: string, framework: string, model: string, html_content: string = "";

    if (contentType.includes("multipart/form-data")) {
       const form = await req.formData();
       tool_type = form.get("tool_type") as string;
       input = form.get("input") as string || "";
       framework = form.get("framework") as string || "playwright";
       model = form.get("model") as string || "kimi-k2";
       const file = form.get("html_file") as File | null;
       if (file) {
         html_content = await file.text();
       }
    } else {
       const body = await req.json();
       tool_type = body.tool_type;
       input = body.input;
       framework = body.framework || "playwright";
       model = body.model || "auto-free";
       html_content = body.html_content || "";
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    let result = "";
    let reportJson: any = null;
    let createdReport: any = null;

    const htmlContext = html_content
      ? `\n\n=== HTML DA APLICAÇÃO (para referência dos seletores) ===\n${html_content.slice(0, 8000)}\n=======================================================`
      : "";

    if (tool_type === "test_cases") {
      const sys = "Você é um engenheiro de QA sênior especialista em criação de casos de teste. "
        + "Sua missão é gerar casos de teste completos, estruturados e profissionais. "
        + "Se o usuário fornecer um código de automação de testes (Playwright, Cypress, Selenium, etc.), analise o código e extraia com precisão cada caso de teste implementado ou implícito nele. "
        + "Retorne EXATAMENTE um JSON válido com o formato: "
        + '{"test_cases": [{"id": "TC001", "title": "...", "category": "happy_path|error|edge_case", "steps": ["passo 1", "passo 2"], "expected_result": "...", "priority": "alta|media|baixa"}]}';

      const usr = "Gere casos de teste completos para a seguinte funcionalidade ou a partir do código de teste abaixo:\n\n" + input + htmlContext
        + "\n\nSe for código de teste, mapeie os steps exatos realizados na automação e o resultado esperado. Cubra cenários de: Happy Path, Erros esperados e Casos de borda. Retorne apenas o JSON.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      // Salva no banco
      try {
        const jsonStr = result.replace(/```json\n?|\n?```/g, "").trim();
        reportJson = JSON.parse(jsonStr);
      } catch { reportJson = null; }

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "test_cases",
        title: "Casos de Teste — " + (input.slice(0, 60) + (input.length > 60 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: reportJson,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "test_report") {
      const sys = "Você é um líder de qualidade especialista em documentação de testes de software. "
        + "Escreva relatórios de teste formais, claros e detalhados em Markdown.";

      const usr = "Crie um relatório de teste de software completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter: 1) Objetivo, 2) Escopo, 3) Ambiente de Testes, "
        + "4) Resumo dos Resultados (tabela), 5) Bugs e Defeitos encontrados, 6) Conclusão e Recomendações.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "test_report",
        title: "Relatório — " + (input.slice(0, 60) + (input.length > 60 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "automation") {
      const fw = framework || "playwright";
      const langMap: Record<string, string> = {
        cypress: "JavaScript/TypeScript com Cypress",
        playwright: "TypeScript com Playwright",
        selenium: "Python com Selenium WebDriver",
      };
      const lang = langMap[fw] || langMap["playwright"];

      const htmlInstruction = html_content
        ? " Use os seletores CSS/ID/data-* reais encontrados no HTML fornecido para garantir que o script funcione corretamente na aplicação real."
        : "";

      const sys = "Você é um engenheiro de automação de testes sênior especializado em " + lang + ". "
        + "Gere scripts de teste automatizado profissionais, bem comentados e prontos para execução imediata." + htmlInstruction
        + " Retorne APENAS o código, sem explicações extras fora do código.";

      const usr = "Crie um script de automação de testes completo usando " + lang + " para:\n\n"
        + input + htmlContext
        + "\n\nInclua: imports, configuração, describe/it (ou equivalente), seletores reais dos elementos, "
        + "asserções claras, tratamento de erros e comentários explicativos em português.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "automation",
        title: "Automação " + fw.charAt(0).toUpperCase() + fw.slice(1) + " — " + (input.slice(0, 50) + (input.length > 50 ? "..." : "")),
        input_description: input,
        framework: fw,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "consolidated_report") {
      // Gera relatório consolidado de todos os relatórios salvos
      const { data: allReports } = await supabase
        .from("qa_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const reportsSummary = (allReports || []).map(r => ({
        tipo: r.type,
        titulo: r.title,
        data: new Date(r.created_at).toLocaleDateString("pt-BR"),
        modelo: r.model_used,
        framework: r.framework,
        resumo: (r.result_raw || "").slice(0, 500),
      }));

      const sys = "Você é um gerente de qualidade sênior. Analise todos os relatórios de teste fornecidos e "
        + "crie um relatório executivo consolidado em Markdown profissional e formal. "
        + "Identifique padrões, tendências, riscos e recomendações estratégicas.";

      const usr = "Com base nos seguintes " + reportsSummary.length + " relatórios de QA gerados:\n\n"
        + JSON.stringify(reportsSummary, null, 2)
        + "\n\nGere um relatório executivo consolidado contendo:\n"
        + "1. **Sumário Executivo** — visão geral do estado da qualidade\n"
        + "2. **Métricas Gerais** — tabela com totais por tipo (casos de teste, automações, relatórios)\n"
        + "3. **Análise por Período** — tendências e evolução\n"
        + "4. **Principais Funcionalidades Testadas**\n"
        + "5. **Padrões e Riscos Identificados**\n"
        + "6. **Recomendações Estratégicas**\n"
        + "7. **Próximas Ações Prioritárias**";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "consolidated_report",
        title: "Relatório Executivo Consolidado — " + new Date().toLocaleDateString("pt-BR"),
        input_description: "Consolidado automático de " + reportsSummary.length + " relatórios",
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else {
      return NextResponse.json({ error: "Invalid tool_type" }, { status: 400 });
    }

    return NextResponse.json({ result, report: createdReport });

  } catch (error: any) {
    console.error("QA API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
