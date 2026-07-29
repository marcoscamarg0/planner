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
      .select("id, user_id, type, title, framework, model_used, input_description, result_json, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Table might not exist yet — return empty list instead of 500
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        console.warn("[GET /api/ai/qa] Tabela qa_reports não encontrada. Execute a migration 007.");
        return NextResponse.json({ reports: [], warning: "Tabela ainda não foi criada. Execute a migration 007_recreate_qa_reports.sql no Supabase." });
      }
      throw error;
    }

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

    } else if (tool_type === "general_test_report") {
      const sys = "Você é um gerente de qualidade sênior especializado em documentação de testes de software. "
        + "Gere um Relatório Geral de Testes completo, formal e profissional em Markdown, seguindo padrões IEEE 829 e ISO/IEC 29119.";

      const usr = "Crie um Relatório Geral de Testes completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — visão geral do ciclo de testes\n"
        + "2. **Escopo e Objetivos** — o que foi testado e por quê\n"
        + "3. **Métricas Gerais** — tabela com total de casos, aprovados, reprovados, bloqueados e pulados\n"
        + "4. **Defeitos Não Resolvidos** — tabela com ID, descrição, severidade e status\n"
        + "5. **Cobertura de Testes** — percentual de cobertura alcançado\n"
        + "6. **Análise de Riscos** — riscos identificados e sua criticidade\n"
        + "7. **Conclusão e Critérios de Saída** — o sistema está apto para produção?\n"
        + "8. **Recomendações** — próximos passos e melhorias sugeridas";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "general_test_report",
        title: "Relatório Geral de Testes — " + (input.slice(0, 50) + (input.length > 50 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "ter") {
      const sys = "Você é um engenheiro de QA sênior especializado em documentação detalhada de execução de testes. "
        + "Gere um Relatório de Execução de Testes (TER — Test Execution Report) completo e estruturado em Markdown, "
        + "seguindo padrões IEEE 829 e ISO/IEC 29119-3.";

      const usr = "Crie um Relatório de Execução de Testes (TER) completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Informações Gerais** — projeto, versão, ambiente, data e responsável pelos testes\n"
        + "2. **Tabela de Execução** — colunas: ID do Caso, Título, Pré-condições, Passos Executados, Resultado Esperado, Resultado Obtido, Status (✅ Aprovado / ❌ Reprovado / ⏭️ Bloqueado), Observações do Testador\n"
        + "3. **Resumo de Execução** — totais por status com percentuais\n"
        + "4. **Evidências e Capturas** — descrição das evidências coletadas\n"
        + "5. **Defeitos Encontrados** — lista de bugs com referência ao ID do caso de teste\n"
        + "6. **Conclusão** — análise geral da execução e recomendações\n"
        + "Formate a tabela de execução como tabela Markdown com alinhamento adequado.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "ter",
        title: "Relatório de Execução (TER) — " + (input.slice(0, 50) + (input.length > 50 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "bug_report") {
      const sys = "Você é um engenheiro de QA especializado em documentação e triagem de defeitos de software. "
        + "Gere um Relatório de Bugs/Erros completo, estruturado e profissional em Markdown, "
        + "seguindo boas práticas de gestão de defeitos (padrões IEEE 1044).";

      const usr = "Crie um Relatório de Bugs/Erros completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário de Defeitos** — tabela resumida: ID, Título, Severidade, Prioridade, Status\n"
        + "2. **Detalhamento de cada Bug:**\n"
        + "   - ID e Título\n"
        + "   - Ambiente (SO, browser, versão da aplicação)\n"
        + "   - Severidade: Crítico / Alto / Médio / Baixo\n"
        + "   - Prioridade: P1-Imediato / P2-Alto / P3-Médio / P4-Baixo\n"
        + "   - Passos para Reprodução (numerados)\n"
        + "   - Resultado Esperado vs. Resultado Obtido\n"
        + "   - Impacto no Negócio\n"
        + "   - Status Atual (Aberto / Em correção / Corrigido / Fechado / Reaberto)\n"
        + "   - Responsável e Data de Abertura\n"
        + "3. **Análise de Tendência** — distribuição por severidade (tabela + texto)\n"
        + "4. **Recomendações de Priorização** — quais bugs corrigir primeiro e por quê";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "bug_report",
        title: "Relatório de Bugs — " + (input.slice(0, 50) + (input.length > 50 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "rtm") {
      const sys = "Você é um engenheiro de qualidade especializado em rastreabilidade de requisitos e cobertura de testes. "
        + "Gere uma Matriz de Rastreabilidade de Requisitos (RTM) completa e estruturada em Markdown, "
        + "garantindo cobertura funcional bidirecional (requisitos → testes e testes → requisitos).";

      const usr = "Crie uma Matriz de Rastreabilidade (RTM) completa com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Introdução** — propósito da RTM e escopo do projeto\n"
        + "2. **Matriz Principal** — tabela Markdown com colunas:\n"
        + "   - ID Requisito | Descrição do Requisito | Prioridade | ID Caso de Teste | Título do Caso | Status de Cobertura | Resultado\n"
        + "3. **Análise de Cobertura** — % de requisitos cobertos, não cobertos e parcialmente cobertos\n"
        + "4. **Requisitos Sem Cobertura** — lista de requisitos sem casos de teste associados\n"
        + "5. **Casos de Teste Órfãos** — testes sem requisito mapeado\n"
        + "6. **Resumo de Conformidade** — o projeto atinge os critérios de saída?\n"
        + "Formate como tabela Markdown bem estruturada com alinhamento correto.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "rtm",
        title: "Matriz de Rastreabilidade (RTM) — " + (input.slice(0, 45) + (input.length > 45 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "smoke_test") {
      const sys = "Você é um engenheiro de QA especializado em testes de sanidade e fumaça (Smoke & Sanity Testing). "
        + "Gere um Relatório de Teste de Fumaça completo e profissional em Markdown, "
        + "focado em verificar rapidamente as funcionalidades críticas após uma nova build ou deploy.";

      const usr = "Crie um Relatório de Teste de Fumaça completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Informações da Build** — versão, ambiente, data do deploy e responsável\n"
        + "2. **Critério de Entrada** — condições para iniciar o smoke test\n"
        + "3. **Checklist de Funcionalidades Críticas** — tabela: Funcionalidade | Descrição | Status (✅/❌/⚠️) | Observação\n"
        + "4. **Resultado Geral** — APROVADO / REPROVADO / PARCIAL com justificativa\n"
        + "5. **Bloqueadores Encontrados** — defeitos que impedem prosseguir com testes completos\n"
        + "6. **Recomendação** — a build está apta para testes de regressão completa?\n"
        + "7. **Critério de Saída** — condições atendidas para encerrar o smoke test";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "smoke_test",
        title: "Relatório de Teste de Fumaça — " + (input.slice(0, 48) + (input.length > 48 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "performance_report") {
      const sys = "Você é um especialista em testes de desempenho e engenharia de confiabilidade de sites (SRE). "
        + "Gere um Relatório de Teste de Desempenho completo, técnico e profissional em Markdown, "
        + "cobrindo métricas de performance, gargalos e recomendações de otimização.";

      const usr = "Crie um Relatório de Teste de Desempenho completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — visão geral dos resultados de performance\n"
        + "2. **Ambiente e Configuração de Testes** — ferramentas usadas, cenários e carga simulada\n"
        + "3. **Métricas de Desempenho** — tabela com:\n"
        + "   - Tempo de Resposta Médio, P90, P95, P99\n"
        + "   - Taxa de Transferência (req/s)\n"
        + "   - Taxa de Erros (%)\n"
        + "   - Utilização de CPU e Memória (pico e média)\n"
        + "4. **Teste de Carga** — comportamento sob carga normal, pico e estresse\n"
        + "5. **Teste de Escalabilidade** — como o sistema se comporta com crescimento de usuários\n"
        + "6. **Gargalos Identificados** — endpoints lentos, queries custosas, vazamentos de memória\n"
        + "7. **Análise de Alocação de Recursos** — eficiência de CPU, memória e I/O\n"
        + "8. **Benchmarks e SLAs** — comparação com metas estabelecidas\n"
        + "9. **Recomendações de Otimização** — ações prioritárias para melhorar performance";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "performance_report",
        title: "Relatório de Desempenho — " + (input.slice(0, 52) + (input.length > 52 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "security_report") {
      const sys = "Você é um especialista em segurança de aplicações (AppSec) e testes de penetração. "
        + "Gere um Relatório de Teste de Segurança completo, detalhado e profissional em Markdown, "
        + "cobrindo vulnerabilidades, impacto, exploração e recomendações de mitigação seguindo OWASP Top 10 e CVSS.";

      const usr = "Crie um Relatório de Teste de Segurança completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — visão geral das vulnerabilidades encontradas e nível de risco geral\n"
        + "2. **Escopo e Metodologia** — superfície de ataque testada e técnicas utilizadas\n"
        + "3. **Tabela de Vulnerabilidades** — ID | Título | Categoria OWASP | CVSS Score | Severidade | Status\n"
        + "4. **Detalhamento de cada Vulnerabilidade:**\n"
        + "   - Descrição técnica\n"
        + "   - Vetor de ataque e exploração\n"
        + "   - Impacto no negócio (confidencialidade, integridade, disponibilidade)\n"
        + "   - Evidências\n"
        + "   - Recomendação de correção (com código de exemplo quando aplicável)\n"
        + "5. **Análise de Superfície de Ataque** — endpoints, autenticação, autorização, dados sensíveis\n"
        + "6. **Distribuição por Severidade** — Crítico / Alto / Médio / Baixo / Informacional\n"
        + "7. **Recomendações Estratégicas** — melhorias de arquitetura e práticas DevSecOps\n"
        + "8. **Plano de Remediação** — priorização e prazo sugerido para correções";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "security_report",
        title: "Relatório de Segurança — " + (input.slice(0, 52) + (input.length > 52 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "regression_report") {
      const sys = "Você é um engenheiro de QA especializado em testes de regressão e gestão de impacto de mudanças. "
        + "Gere um Relatório de Teste de Regressão completo e profissional em Markdown, "
        + "avaliando como novos recursos ou correções impactam a funcionalidade existente do sistema.";

      const usr = "Crie um Relatório de Teste de Regressão completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Contexto da Mudança** — o que foi alterado, por que e qual versão\n"
        + "2. **Estratégia de Regressão** — suíte de testes selecionada, critérios de seleção (impacto, histórico)\n"
        + "3. **Resultados da Execução** — tabela: Módulo | Casos Executados | Aprovados | Reprovados | Novos Bugs\n"
        + "4. **Análise de Impacto** — funcionalidades afetadas pelos novos recursos ou correções\n"
        + "5. **Regressões Detectadas** — lista de bugs reintroduzidos ou novas falhas em código existente\n"
        + "6. **Estabilidade por Módulo** — gráfico textual/tabela de estabilidade de cada área do sistema\n"
        + "7. **Comparativo com Baseline** — comparação com ciclo de testes anterior\n"
        + "8. **Conclusão** — o sistema manteve sua estabilidade após a mudança?\n"
        + "9. **Recomendações** — melhorias na suíte de regressão e automação sugerida (@tags, filtros)";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "regression_report",
        title: "Relatório de Regressão — " + (input.slice(0, 50) + (input.length > 50 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "compliance_report") {
      const sys = "Você é um especialista em conformidade regulatória e auditorias de qualidade de software. "
        + "Gere um Relatório de Conformidade completo, formal e profissional em Markdown, "
        + "verificando aderência às normas relevantes (LGPD, ISO 27001, PCI-DSS, HIPAA, SOX, GDPR, etc.).";

      const usr = "Crie um Relatório de Conformidade completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — nível geral de conformidade e principais achados\n"
        + "2. **Normas e Regulamentações Avaliadas** — lista das normas verificadas e sua aplicabilidade\n"
        + "3. **Metodologia de Avaliação** — como a auditoria foi conduzida\n"
        + "4. **Matriz de Conformidade** — tabela: Requisito Normativo | Controle Implementado | Status (✅ Conforme / ❌ Não Conforme / ⚠️ Parcial) | Evidência | Risco\n"
        + "5. **Não Conformidades Encontradas** — detalhamento de cada item não atendido com impacto e prazo\n"
        + "6. **Conformidades Destacadas** — boas práticas identificadas\n"
        + "7. **Análise de Risco Regulatório** — exposição a penalidades e danos reputacionais\n"
        + "8. **Plano de Ação Corretiva** — medidas para atingir conformidade com responsáveis e prazos\n"
        + "9. **Conclusão** — o sistema está apto para certificação ou auditoria externa?";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "compliance_report",
        title: "Relatório de Conformidade — " + (input.slice(0, 48) + (input.length > 48 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "uat_report") {
      const sys = "Você é um especialista em testes de aceitação do usuário (UAT — User Acceptance Testing) e UX. "
        + "Gere um Relatório de UAT completo, estruturado e profissional em Markdown, "
        + "documentando os resultados dos testes conduzidos por usuários finais e avaliando a prontidão do produto.";

      const usr = "Crie um Relatório de Teste de Aceitação do Usuário (UAT) completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Informações do UAT** — projeto, versão, período de testes, perfil dos usuários participantes\n"
        + "2. **Objetivos e Critérios de Aceitação** — o que o produto deve fazer para ser aceito\n"
        + "3. **Participantes** — perfis de usuário, papéis e quantidade\n"
        + "4. **Cenários Testados** — lista de fluxos de negócio avaliados pelos usuários\n"
        + "5. **Resultados por Cenário** — tabela: Cenário | Usuário | Resultado | Dificuldades | Sugestões\n"
        + "6. **Problemas Identificados pelos Usuários** — lista com frequência, severidade e impacto na experiência\n"
        + "7. **Avaliação de Usabilidade** — facilidade de uso, clareza da interface, satisfação geral (NPS/escala)\n"
        + "8. **Feedback Qualitativo** — principais comentários e percepções dos usuários\n"
        + "9. **Critério de Aceitação Final** — ACEITO / ACEITO COM RESSALVAS / REJEITADO com justificativa\n"
        + "10. **Recomendações** — ajustes necessários antes do go-live e melhorias futuras\n"
        + "11. **Conclusão** — o produto está pronto para implantação em produção?";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        type: "uat_report",
        title: "Relatório de UAT — " + (input.slice(0, 55) + (input.length > 55 ? "..." : "")),
        input_description: input,
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
