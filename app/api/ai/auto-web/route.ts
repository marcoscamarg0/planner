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
  const model = AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS["kimi-k2"];
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://planner-j53e.onrender.com",
      "X-Title": "Planner AutoWeb",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 6000 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("OpenRouter error [" + response.status + "]: " + err);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInteractiveElements(html: string): string {
  const elements: string[] = [];

  // Extract buttons
  const btnReg = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  let m;
  while ((m = btnReg.exec(html)) !== null) {
    const tag = m[0].slice(0, 200);
    elements.push("BUTTON: " + tag.replace(/\n/g, " ").trim());
  }

  // Extract inputs
  const inputReg = /<input[^>]*>/gi;
  while ((m = inputReg.exec(html)) !== null) {
    const tag = m[0].slice(0, 200);
    elements.push("INPUT: " + tag.replace(/\n/g, " ").trim());
  }

  // Extract forms
  const formReg = /<form[^>]*>/gi;
  while ((m = formReg.exec(html)) !== null) {
    const tag = m[0].slice(0, 200);
    elements.push("FORM: " + tag.replace(/\n/g, " ").trim());
  }

  // Extract links
  const linkReg = /<a[^>]*href=[^>]*>([\s\S]*?)<\/a>/gi;
  let linkCount = 0;
  while ((m = linkReg.exec(html)) !== null && linkCount < 20) {
    const tag = m[0].slice(0, 200);
    elements.push("LINK: " + tag.replace(/\n/g, " ").trim());
    linkCount++;
  }

  // Extract selects
  const selectReg = /<select[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = selectReg.exec(html)) !== null) {
    const tag = m[0].slice(0, 300);
    elements.push("SELECT: " + tag.replace(/\n/g, " ").trim());
  }

  return elements.slice(0, 80).join("\n");
}

function buildPackageJson(framework: string, projectName: string): object {
  const fw = framework.toLowerCase();

  if (fw === "playwright") {
    return {
      name: projectName,
      version: "1.0.0",
      description: "Automação gerada automaticamente por IA - Planner QA",
      scripts: {
        test: "npx playwright test",
        "test:headed": "npx playwright test --headed",
        "test:report": "npx playwright show-report",
        install: "npx playwright install",
      },
      devDependencies: {
        "@playwright/test": "^1.44.0",
        typescript: "^5.4.5",
        "@types/node": "^20.12.12",
      },
    };
  } else if (fw === "cypress") {
    return {
      name: projectName,
      version: "1.0.0",
      description: "Automação gerada automaticamente por IA - Planner QA",
      scripts: {
        test: "npx cypress run",
        "test:open": "npx cypress open",
        "test:headed": "npx cypress run --headed",
      },
      devDependencies: {
        cypress: "^13.9.0",
      },
    };
  } else {
    // selenium / python — return requirements.txt style
    return {
      name: projectName,
      version: "1.0.0",
      description: "Automação Selenium — instale com: pip install -r requirements.txt",
      scripts: {
        install: "pip install -r requirements.txt",
        test: "python test_automation.py",
      },
      requirements: [
        "selenium==4.21.0",
        "pytest==8.2.0",
        "webdriver-manager==4.0.1",
        "pytest-html==4.1.1",
      ],
      _note: "Para Python/Selenium: crie requirements.txt com as dependências acima e use pip install -r requirements.txt",
    };
  }
}

// GET: fetch all auto-web reports for user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("auto_web_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Table might not exist yet — return empty
      return NextResponse.json({ reports: [] });
    }

    return NextResponse.json({ reports: data ?? [] });
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

    let action: string = "";
    let url: string = "";
    let htmlContent: string = "";
    let framework: string = "playwright";
    let model: string = "kimi-k2";
    let description: string = "";
    let projectName: string = "auto-test";
    let scriptContent: string = "";
    let reportContent: string = "";
    let reportId: string = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      action = form.get("action") as string || "";
      url = form.get("url") as string || "";
      framework = form.get("framework") as string || "playwright";
      model = form.get("model") as string || "kimi-k2";
      description = form.get("description") as string || "";
      projectName = form.get("projectName") as string || "auto-test";
      scriptContent = form.get("scriptContent") as string || "";
      reportContent = form.get("reportContent") as string || "";
      reportId = form.get("reportId") as string || "";
      const file = form.get("html_file") as File | null;
      if (file) {
        htmlContent = await file.text();
      }
    } else {
      const body = await req.json();
      action = body.action || "";
      url = body.url || "";
      htmlContent = body.html_content || "";
      framework = body.framework || "playwright";
      model = body.model || "kimi-k2";
      description = body.description || "";
      projectName = body.projectName || "auto-test";
      scriptContent = body.scriptContent || "";
      reportContent = body.reportContent || "";
      reportId = body.reportId || "";
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    // Action: Manual Insert
    if (action === "manual") {
      const packageJson = buildPackageJson(framework, projectName);
      const { data, error } = await supabase
        .from("auto_web_reports")
        .insert({
          user_id: user.id,
          source_url: url || null,
          source_name: projectName || url || "Relatório Manual",
          framework,
          model_used: "manual",
          project_name: projectName,
          script_content: scriptContent,
          package_json: packageJson,
          report_content: reportContent,
          description: description || "Relatório adicionado manualmente",
        })
        .select()
        .single();

      if (error) {
        throw new Error("Erro ao salvar no banco: " + error.message);
      }

      return NextResponse.json(data);
    }

    // Action: Improve existing report with AI
    if (action === "improve") {
      const sysPrompt = `Você é um Líder de QA Sênior especialista em auditoria de qualidade, acessibilidade e automação de testes.
Sua missão é reescrever o relatório técnico fornecido para torná-lo EXTREMAMENTE profissional, completo e bem estruturado.
Adicione análises profundas, detalhes de boas práticas (como eMAG 3.1 e WCAG 2.1 AA se aplicável) e métricas claras.

IMPORTANTE: Você DEVE incluir uma seção de métricas com a exata estrutura abaixo no início do relatório para que o sistema renderize os gráficos/cards corretamente:
MÉTRICAS DO RELATÓRIO:
- Total de Testes: [Número]
- Casos de Teste Aprovados: [Número]
- Falhas Identificadas: [Número]
- Violações de Acessibilidade/Regras: [Número]

Adicione também recomendações formais sob títulos claros como "Recomendações eMAG" ou "Recomendações de Estabilidade" e detalhe cada violação encontrada com classe/seletor do elemento afetado e sugestão de correção.`;

      const userPrompt = `Abaixo está o script de automação e o relatório preliminar atual. Melhore o relatório deixando-o rico, técnico e muito mais profissional.

SCRIPT DE TESTE:
${scriptContent}

RELATÓRIO ATUAL:
${reportContent}`;

      const improvedContent = await callOpenRouter(
        [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
        model, apiKey
      );

      // If reportId provided, update it in DB
      if (reportId && reportId !== "new") {
        await supabase
          .from("auto_web_reports")
          .update({ report_content: improvedContent })
          .eq("id", reportId)
          .eq("user_id", user.id);
      }

      return NextResponse.json({ report: improvedContent });
    }

    // Default Action: AI Generation
    // If URL provided, fetch the HTML
    let sourceHtml = htmlContent;
    let pageTitle = "";
    let fetchError = "";

    if (url && !htmlContent) {
      try {
        const fetchRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PlannerQA/1.0)",
            "Accept": "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (fetchRes.ok) {
          sourceHtml = await fetchRes.text();
          // Extract title
          const titleMatch = sourceHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
          pageTitle = titleMatch ? titleMatch[1].trim() : url;
        } else {
          fetchError = `HTTP ${fetchRes.status}: não foi possível acessar a URL`;
        }
      } catch (e: any) {
        fetchError = `Erro de rede: ${e.message}`;
      }
    }

    if (!sourceHtml && fetchError) {
      return NextResponse.json({
        error: `Não foi possível obter o HTML da URL. ${fetchError}. Tente colar o HTML diretamente.`
      }, { status: 422 });
    }

    if (!sourceHtml) {
      return NextResponse.json({ error: "Forneça uma URL acessível ou cole/faça upload do HTML." }, { status: 400 });
    }

    // Extract interactive elements for precise selectors
    const interactiveElements = extractInteractiveElements(sourceHtml);
    const textContent = stripHtml(sourceHtml).slice(0, 3000);

    const fw = framework.toLowerCase();
    const langMap: Record<string, string> = {
      playwright: "TypeScript com Playwright",
      cypress: "JavaScript com Cypress",
      selenium: "Python com Selenium + pytest",
    };
    const lang = langMap[fw] || langMap["playwright"];

    const sysPrompt = `Você é um especialista em automação de testes web de nível sênior.
Sua missão é gerar um script de automação COMPLETO e FUNCIONAL usando ${lang}.

REGRAS CRÍTICAS:
1. Use os seletores REAIS extraídos do HTML (IDs, name, data-*, aria-*, classes específicas)
2. Priorize: #id > [data-testid] > [name] > [aria-label] > .classe-específica
3. Gere casos de teste completos: happy path, erros, edge cases
4. Inclua comentários em português explicando cada bloco
5. O script deve funcionar imediatamente após npm install / pip install
6. Retorne APENAS o código, sem markdown blocks (sem \`\`\`)
7. Seja extremamente detalhado e profissional`;

    const userPrompt = `URL da página: ${url || "arquivo HTML local"}
${pageTitle ? `Título da página: ${pageTitle}` : ""}
${description ? `Instruções adicionais: ${description}` : ""}

=== ELEMENTOS INTERATIVOS ENCONTRADOS NO HTML ===
${interactiveElements || "Nenhum elemento interativo identificado — use os textos para navegar"}

=== CONTEÚDO DA PÁGINA ===
${textContent}

Gere um script de automação completo em ${lang} que:
1. Acesse a página (use a URL: ${url || "// Substitua pela URL real"})
2. Teste TODOS os fluxos principais identificados nos elementos acima
3. Inclua assertions/verificações claras
4. Gerencie esperas (waitFor, expect, etc.)
5. Trate erros e screenshots em caso de falha
6. Inclua setup e teardown

Retorne APENAS o código do script sem nenhum bloco markdown.`;

    const scriptContent = await callOpenRouter(
      [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      model, apiKey
    );

    // Generate package.json
    const packageJson = buildPackageJson(framework, projectName);

    // Generate a markdown report
    const reportPrompt = `Com base no script de automação gerado abaixo, crie um relatório técnico de testes em Markdown.
O relatório deve ser formal, detalhado e muito profissional.

IMPORTANTE: Você deve incluir as métricas exatas do relatório no início sob a seguinte estrutura para que possamos parsear e criar cards/gráficos:
MÉTRICAS DO RELATÓRIO:
- Total de Testes: [Número estimado de fluxos testados]
- Casos de Teste Aprovados: [Número estimado]
- Falhas Identificadas: [Número estimado]
- Violações de Acessibilidade/Regras: [Número estimado]

O relatório deve conter:
1. **Resumo** - O que foi automatizado e a URL testada
2. **Métricas do Relatório** - A lista estruturada descrita acima
3. **Casos de Teste Identificados** - Tabela com ID, nome, tipo e prioridade
4. **Cobertura** - Elementos/fluxos cobertos vs. descobertos
5. **Como Executar** - Passo a passo para instalar e rodar
6. **Configuração do Ambiente** - Pré-requisitos e variáveis
7. **Próximos Passos e Recomendações** - Melhorias sugeridas, e se houver, notas sobre acessibilidade (eMAG / WCAG).

Script gerado:
${scriptContent.slice(0, 3000)}`;

    const reportContent = await callOpenRouter(
      [
        { role: "system", content: "Você é um líder de QA especialista em documentação. Escreva em português, formal e detalhado." },
        { role: "user", content: reportPrompt }
      ],
      model, apiKey
    );

    // Try to save to database (silently fail if table doesn't exist)
    try {
      await supabase.from("auto_web_reports").insert({
        user_id: user.id,
        source_url: url || null,
        source_name: pageTitle || projectName,
        framework,
        model_used: model,
        project_name: projectName,
        script_content: scriptContent,
        package_json: packageJson,
        report_content: reportContent,
        description,
      });
    } catch (dbErr) {
      console.warn("auto_web_reports table not found — skipping save:", dbErr);
    }

    return NextResponse.json({
      script: scriptContent,
      packageJson,
      report: reportContent,
      pageTitle: pageTitle || projectName,
      framework,
      elementsFound: interactiveElements.split("\n").length,
    });

  } catch (error: any) {
    console.error("AutoWeb error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
