import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chromium } from "@playwright/test";

export const runtime = "nodejs";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface TestStep {
  action: "goto" | "click" | "type" | "wait" | "select" | "check";
  url?: string;
  selector?: string;
  text?: string;
  milliseconds?: number;
  description: string;
}

// Translate code to a simple set of Playwright actions
async function translateScriptToSteps(script: string, url: string): Promise<TestStep[]> {
  if (!OPENROUTER_API_KEY) {
    // Fallback simple step parsing
    return [
      { action: "goto", url, description: `Acessar a URL inicial: ${url}` }
    ];
  }

  const sysPrompt = "Você é um interpretador que traduz scripts de automação (Playwright, Cypress, Selenium) em um array JSON de comandos simples e sequenciais de navegação web. "
    + "Retorne EXATAMENTE um JSON válido no formato:\n"
    + '{"steps": [{"action": "goto|click|type|wait|select|check", "url": "...", "selector": "...", "text": "...", "milliseconds": 1000, "description": "Descrição amigável do passo"}]}';

  const usrPrompt = `Traduz o seguinte script de automação para rodar no site ${url}:\n\n${script}\n\nRetorne apenas o JSON.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_API_KEY,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://planner-j53e.onrender.com",
        "X-Title": "Planner QA Suite",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: usrPrompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      if (parsed.steps && Array.isArray(parsed.steps)) {
        return parsed.steps;
      }
    }
  } catch (err) {
    console.error("Failed to translate script via AI:", err);
  }

  // Fallback default
  return [
    { action: "goto", url, description: `Acessar a URL inicial: ${url}` }
  ];
}

export async function POST(req: Request) {
  let browser;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { url, script } = await req.json();
    if (!url || !script) {
      return NextResponse.json({ error: "URL e script de automação são obrigatórios" }, { status: 400 });
    }

    // 1. Translate the script code into executable JSON steps
    const steps = await translateScriptToSteps(script, url);

    // 2. Launch headless browser
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    const executionLogs: string[] = [];
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];

    // Capture console output
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture unhandled exceptions
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const results: {
      description: string;
      status: "success" | "failed";
      screenshot?: string;
      error?: string;
    }[] = [];

    let success = true;

    // 3. Execute steps one by one
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      executionLogs.push(`Executando Passo ${i + 1}: ${step.description}`);

      try {
        if (step.action === "goto") {
          const targetUrl = step.url || url;
          await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 15000 });
        } else if (step.action === "click") {
          if (!step.selector) throw new Error("Seletor não informado para clique.");
          await page.waitForSelector(step.selector, { timeout: 5000 });
          await page.click(step.selector);
        } else if (step.action === "type") {
          if (!step.selector) throw new Error("Seletor não informado para digitação.");
          await page.waitForSelector(step.selector, { timeout: 5000 });
          await page.fill(step.selector, step.text || "");
        } else if (step.action === "wait") {
          await page.waitForTimeout(step.milliseconds || 1000);
        } else if (step.action === "select") {
          if (!step.selector) throw new Error("Seletor não informado para seleção.");
          await page.waitForSelector(step.selector, { timeout: 5000 });
          await page.selectOption(step.selector, step.text || "");
        } else if (step.action === "check") {
          if (!step.selector) throw new Error("Seletor não informado para checkbox.");
          await page.waitForSelector(step.selector, { timeout: 5000 });
          await page.check(step.selector);
        }

        // Take a screenshot of the state after executing the step
        const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 50 });
        results.push({
          description: step.description,
          status: "success",
          screenshot: `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`
        });

      } catch (stepErr: any) {
        success = false;
        executionLogs.push(`Erro no Passo ${i + 1}: ${stepErr.message}`);
        
        let screenshot: string | undefined;
        try {
          const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 60 });
          screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`;
        } catch { /* ignore */ }

        results.push({
          description: step.description,
          status: "failed",
          error: stepErr.message,
          screenshot
        });

        // Break execution on first failure
        break;
      }
    }

    // 4. Generate a comprehensive AI report of the run
    let reportMarkdown = "";
    if (OPENROUTER_API_KEY) {
      const sysPrompt = "Você é um Auditor de QA sênior. Com base nos resultados de execução do script de automação, crie um relatório de execução detalhado, formal e profissional em Markdown.";
      const usrPrompt = `URL: ${url}
Script de Origem:
${script}

Passos Executados:
${JSON.stringify(results.map(r => ({ desc: r.description, status: r.status, err: r.error })), null, 2)}

Logs do Console:
${consoleLogs.slice(0, 50).join("\n")}

Erros de Página:
${pageErrors.join("\n")}

Gere um relatório estruturado contendo:
1. **Sumário Executivo** (Status Final: ${success ? "APROVADO" : "FALHOU"})
2. **Histórico de Passos Executados** (tabela com status de cada passo)
3. **Erros e Alertas Identificados** (incluindo logs do console e exceções se houver)
4. **Recomendações Técnicas e Correções** (sugestões de correções para seletores ou fluxos se houver falhas)`;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + OPENROUTER_API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://planner-j53e.onrender.com",
            "X-Title": "Planner QA Suite",
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [{ role: "system", content: sysPrompt }, { role: "user", content: usrPrompt }],
            temperature: 0.2
          }),
        });

        if (response.ok) {
          const data = await response.json();
          reportMarkdown = data.choices[0]?.message?.content || "";
        }
      } catch (err) {
        console.error("AI Report generation failed:", err);
      }
    }

    if (!reportMarkdown) {
      // Fallback simple markdown report
      reportMarkdown = `# Relatório de Execução de Testes
**URL**: ${url}
**Status**: ${success ? "✅ APROVADO" : "❌ FALHOU"}

## Passos Realizados
${results.map((r, index) => `- Passo ${index + 1}: ${r.description} -> **${r.status.toUpperCase()}** ${r.error ? `(${r.error})` : ""}`).join("\n")}
`;
    }

    return NextResponse.json({
      success,
      steps: results,
      consoleLogs,
      pageErrors,
      reportMarkdown
    });

  } catch (error: any) {
    console.error("Runner execution error:", error);
    return NextResponse.json({ error: error.message || "Falha ao rodar automação no servidor" }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
