// -------------------------------------------------------
// POST /api/automation/smart-run
// Fluxo completo: URL + descrição → IA gera código →
// traduz em passos → Playwright executa → PDF retornado
// -------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReportHtml } from '@/lib/worker/report-generator';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// Dynamic import so Next.js doesn't try to bundle playwright at compile time
async function getChromium() {
  const pw = await import('@playwright/test');
  return pw.chromium;
}



const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// -------------------------------------------------------
// Tipos internos
// -------------------------------------------------------
interface SmartStep {
  action: 'goto' | 'click' | 'type' | 'wait' | 'scroll' | 'hover';
  label: string;
  selectorType?: 'role' | 'text' | 'css' | 'id';
  selector?: string;
  value?: string;
  milliseconds?: number;
  isPopup?: boolean;
}

// -------------------------------------------------------
// Etapa 1: IA gera os passos a partir da descrição do usuário
// -------------------------------------------------------
async function generateStepsFromDescription(
  targetUrl: string,
  flowDescription: string,
  model: string,
  contextImages: string[] = []
): Promise<SmartStep[]> {


  const modelMap: Record<string, string> = {
    'auto-free':     'openrouter/auto',
    'nemotron-super':'nvidia/nemotron-3-super-120b-a12b:free',
    'laguna-xs':     'poolside/laguna-xs-2.1:free',
    'gpt-oss':       'openai/gpt-oss-20b:free',
    'cohere-north':  'cohere/north-mini-code:free',
    'qwen-coder':    'qwen/qwen-2.5-coder-32b-instruct:free',
    'kimi-k2':       'moonshotai/kimi-k2',
  };
  const llmModel = modelMap[model] || 'openrouter/auto';

  const systemPrompt = `Você é um Engenheiro de Qualidade de Software (QA Automation Specialist) especialista em Playwright.
Dado uma URL e a descrição ou CÓDIGO DE TESTE do usuário, gere um array de passos de automação em JSON.

REGRAS ESSENCIAIS:
1. SUPORTE A CÓDIGO PLAYWRIGHT: Se o usuário colar um script Playwright (ex: test(...), page.getByRole(...), page.getByTitle(...), page.locator(...), waitForEvent(...)), PARSEIE E CONVERTA CADA LINHA DE COMANDO DE TESTE EM UM PASSO DE AUTOMAÇÃO JSON NA ORDEM EXATA DO SCRIPT.
2. MAPEAMENTO DE SELETORES DO CÓDIGO:
   - page.getByRole('link', { name: 'X' }).click() => selectorType: "role", selector: "link", value: "X", action: "click", label: "Clicar no link X"
   - page.getByRole('button', { name: 'Y' }).click() => selectorType: "role", selector: "button", value: "Y", action: "click", label: "Clicar no botão Y"
   - page.getByTitle('Z').click() => selectorType: "css", selector: "[title='Z']", action: "click", label: "Clicar em Z"
   - page.getByText('T').click() => selectorType: "text", value: "T", action: "click", label: "Clicar em T"
   - page.waitForEvent('popup') + click() => marq isPopup: true
3. PRESERVE TODOS OS PASSOS: Não omita nenhum comando fornecido no script do usuário.
4. LABELS CLAROS E EXECUTIVOS: Crie descrições claras em português para cada passo (ex: "Clicar no link 'Iniciar'", "Acessar 'Outras Informações'").

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "steps": [
    {
      "action": "goto|click|type|wait|scroll|hover",
      "label": "Descrição clara da ação",
      "selectorType": "role|text|css|id",
      "selector": "button|link|[title='x']|#id",
      "value": "URL para goto, texto para type, nome para role/link",
      "milliseconds": 1000,
      "isPopup": false
    }
  ]
}`;

  const userPrompt = `URL: ${targetUrl}
  
Fluxo/Código fornecido:
${flowDescription}

Converter e gerar os passos de automação Playwright correspondentes.`;

  if (!OPENROUTER_API_KEY) {
    // Fallback simples sem IA
    return [
      { action: 'goto', label: `Acessar ${targetUrl}`, value: targetUrl },
      { action: 'wait', label: 'Aguardar carregamento', milliseconds: 2000 },
      { action: 'scroll', label: 'Rolar a página', selectorType: 'css', selector: 'body' },
    ];
  }

    let userMessageContent: any = userPrompt;
    if (contextImages && contextImages.length > 0) {
      userMessageContent = [
        { type: "text", text: userPrompt },
        ...contextImages.map(imgBase64 => ({
          type: "image_url",
          image_url: { url: imgBase64.startsWith('data:image') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}` }
        }))
      ];
    }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {

      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://planner-j53e.onrender.com',
        'X-Title': 'Planner QA Smart Runner',
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessageContent },
        ],

        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      // Procura pelo primeiro { e o último } no texto para garantir que pega apenas o JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let cleaned = jsonMatch ? jsonMatch[0] : content.replace(/```json\n?|\n?```/g, '').trim();
      
      let parsed: any;
      try {
        if (!cleaned) throw new Error("A IA retornou conteúdo vazio.");
        // Tenta remover virgulas sobrando no fim de arrays/objetos que a IA as vezes deixa
        cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[SmartRun] Falha ao fazer parse do JSON retornado. Conteúdo:', cleaned);
        throw parseErr;
      }

      if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        console.log(`[SmartRun] IA gerou ${parsed.steps.length} passos`);
        return parsed.steps as SmartStep[];
      }
    }
  } catch (err) {
    console.error('[SmartRun] Falha ao gerar passos via IA:', err);
  }

  // Fallback
  return [
    { action: 'goto', label: `Acessar ${targetUrl}`, value: targetUrl },
    { action: 'wait', label: 'Aguardar carregamento', milliseconds: 2000 },
  ];
}

// -------------------------------------------------------
// Etapa 2: Executar passos com Playwright
// -------------------------------------------------------
interface StepResult {
  index: number;
  label: string;
  status: 'aprovado' | 'falha_clique' | 'erro_js' | 'pulado';
  detalhe: string;
  screenshotBase64?: string;
  duration?: number;
}

async function autoAcceptCookies(page: any) {
  try {
    const selectors = [
      "button:has-text('Aceitar')",
      "button:has-text('Aceitar todos')",
      "button:has-text('Aceitar Cookies')",
      "button:has-text('Aceitar cookies')",
      "button:has-text('Concordar')",
      "button:has-text('Prosseguir')",
      "button:has-text('Entendi')",
      "button:has-text('OK')",
      "a:has-text('Aceitar')",
      "[id*='cookie'] button",
      "[class*='cookie'] button",
      "[id*='lgpd'] button",
      "[class*='lgpd'] button",
      "#lgpd-accept",
      "#btn-accept-cookie",
    ];

    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        await btn.click({ timeout: 800 }).catch(() => {});
        await page.waitForTimeout(300);
        console.log(`[SmartRun] Banner de cookies aceito automaticamente: ${sel}`);
        break;
      }
    }
  } catch { /* ignore cookie check errors */ }
}

async function runStep(
  page: any,
  step: SmartStep,
  index: number,
  baseUrl: string
): Promise<StepResult> {
  const start = Date.now();
  let screenshotBase64: string | undefined;

  const takeScreenshot = async (fullPage = false): Promise<string | undefined> => {
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 70, fullPage, timeout: 5000 });
      return (buf as Buffer).toString('base64');
    } catch { return undefined; }
  };

  try {
    if (step.action === 'goto') {
      await page.goto(step.value || baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await autoAcceptCookies(page);
      await page.waitForTimeout(1000);
      screenshotBase64 = await takeScreenshot();
      return { index, label: step.label, status: 'aprovado', detalhe: `Navegou para: ${step.value || baseUrl}`, screenshotBase64, duration: Date.now() - start };
    }

    if (step.action === 'wait') {
      await page.waitForTimeout(step.milliseconds || 1500);
      screenshotBase64 = await takeScreenshot();
      return { index, label: step.label, status: 'aprovado', detalhe: `Aguardou ${step.milliseconds || 1500}ms`, screenshotBase64, duration: Date.now() - start };
    }

    if (step.action === 'scroll') {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
      await page.waitForTimeout(800);
      screenshotBase64 = await takeScreenshot();
      return { index, label: step.label, status: 'aprovado', detalhe: 'Rolagem da página executada.', screenshotBase64, duration: Date.now() - start };
    }

    // Construir locator
    let locator: any;
    switch (step.selectorType) {
      case 'role':
        locator = page.getByRole(step.selector as any, step.value ? { name: step.value } : {});
        break;
      case 'text':
        locator = page.getByText(step.value || step.selector || '', { exact: false });
        break;
      case 'id':
        locator = page.locator(`#${step.selector}`);
        break;
      default: // css
        locator = page.locator(step.selector || 'body');
    }

    // Tentar aceitar cookies caso haja um banner visível cobrindo a tela
    await autoAcceptCookies(page);

    // Scroll para o elemento
    await locator.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});

    // Highlight visual temporário antes da ação
    const originalStyle = await locator.evaluate((el: HTMLElement) => {
      const old = { shadow: el.style.boxShadow, outline: el.style.outline, transition: el.style.transition };
      el.style.transition = 'none';
      el.style.setProperty('box-shadow', '0 0 0 4px #ef4444, 0 0 20px rgba(239,68,68,0.8)', 'important');
      el.style.setProperty('outline', '3px solid #ef4444', 'important');
      el.style.setProperty('outline-offset', '3px', 'important');
      return old;
    }).catch(() => null);

    await page.waitForTimeout(400); // Breve pausa para mostrar o highlight

    // Remover highlight antes de executar a ação
    if (originalStyle) {
      await locator.evaluate((el: HTMLElement, old: any) => {
        el.style.transition = old.transition || '';
        el.style.boxShadow = old.shadow || '';
        el.style.outline = old.outline || '';
      }, originalStyle).catch(() => {});
    }

    // Executar ação
    if (step.action === 'type') {
      await locator.fill(step.value || '', { timeout: 8000 });
      await page.waitForTimeout(500);
    } else if (step.action === 'hover') {
      await locator.hover({ timeout: 8000 });
      await page.waitForTimeout(600);
    } else {
      // click
      if (step.isPopup) {
        const popup = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
        await locator.click({ timeout: 5000 });
        await popup;
      } else {
        await locator.click({ timeout: 5000 });
      }
      // Aguardar a página reagir (navegação, modal, animação, etc.)
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(1500),
      ]);
    }

    // Screenshot APÓS a ação — captura a evidência real do clique/resultado
    screenshotBase64 = await takeScreenshot();

    const detalhe = step.action === 'type'
      ? `Digitado: "${step.value}" no campo.`
      : step.action === 'hover'
      ? `Hover realizado com sucesso.`
      : `Clique executado. URL alcançada: ${page.url()}`;

    // RETORNAR PARA A TELA INICIAL APÓS CADA PASSO
    try {
      if (step.action !== 'goto') {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await autoAcceptCookies(page);
        await page.waitForTimeout(400);
      }
    } catch { /* ignore reset error */ }

    return { index, label: step.label, status: 'aprovado', detalhe, screenshotBase64, duration: Date.now() - start };

  } catch (err: unknown) {
    // Em caso de erro, tenta capturar o estado atual da página para evidência
    screenshotBase64 = await takeScreenshot().catch(() => undefined);
    
    // Tenta retornar para a URL base mesmo após erro
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    } catch { /* ignore */ }

    const msg = err instanceof Error ? err.message.split('\n')[0].substring(0, 200) : String(err);
    return { index, label: step.label, status: 'falha_clique', detalhe: `Falha: ${msg}`, screenshotBase64, duration: Date.now() - start };
  }
}


// -------------------------------------------------------
// Route Handler — POST
// -------------------------------------------------------
export async function POST(req: Request) {
  let browser: any;
  const runId = randomUUID();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { targetUrl, flowDescription, jobName, model = 'auto-free', includeAxe = true, contextImages = [] } = body;

    if (!targetUrl || !flowDescription) {
      return NextResponse.json({ error: 'targetUrl e flowDescription são obrigatórios' }, { status: 400 });
    }

    console.log(`[SmartRun] Iniciando: ${targetUrl}`);

    // 1. IA gera os passos
    console.log('[SmartRun] Gerando passos via IA...');
    const steps = await generateStepsFromDescription(targetUrl, flowDescription, model, contextImages);

    console.log(`[SmartRun] ${steps.length} passos gerados`);

    // 2. Executar com Playwright
    const chromium = await getChromium();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });


    const context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.addInitScript(() => { window.print = () => {}; });

    // 3. Rodar auditoria Axe (opcional)
    let axeViolations: any[] = [];
    if (includeAxe) {
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const { default: AxeBuilder } = await import('@axe-core/playwright');
        const axeResult = await (new (AxeBuilder as any)({ page }))
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        axeViolations = axeResult.violations;
        console.log(`[SmartRun] Axe: ${axeViolations.length} violações`);
      } catch (e) {
        console.warn('[SmartRun] Axe opcional falhou:', e);
      }
    }

    // 4. Executar passos
    const stepResults: StepResult[] = [];
    for (let i = 0; i < steps.length; i++) {
      console.log(`[SmartRun] Passo ${i + 1}/${steps.length}: ${steps[i].label}`);
      const r = await runStep(page, steps[i], i + 1, targetUrl);
      stepResults.push(r);
    }

    // 5. Screenshot final da página
    let finalScreenshot: string | undefined;
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
      finalScreenshot = buf.toString('base64');
    } catch { /* opcional */ }

    await context.close();

    // 6. Gerar PDF
    const approved = stepResults.filter(r => r.status === 'aprovado').length;
    const failed   = stepResults.filter(r => r.status !== 'aprovado').length;
    const displayName = jobName || `Auditoria de ${new URL(targetUrl).hostname}`;

    const htmlContent = buildReportHtml({
      results: stepResults,
      axeViolations,
      targetUrl,
      jobName: displayName,
    });

    const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const htmlFilename = `smart-${runId}.html`;
    const htmlPath = path.join(reportsDir, htmlFilename);
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    let pdfUrl: string | undefined;
    let htmlReportUrl = `/reports/${htmlFilename}`;

    try {
      // Usar nova página do browser para gerar PDF
      const chromiumPdf = await getChromium();
      const pdfBrowser = await chromiumPdf.launch({ headless: true, args: ['--no-sandbox'] });

      const pdfPage = await pdfBrowser.newPage();
      await pdfPage.setContent(htmlContent, { waitUntil: 'networkidle', timeout: 30000 });
      const pdfFilename = `smart-${runId}.pdf`;
      const pdfPath = path.join(reportsDir, pdfFilename);
      await pdfPage.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      await pdfBrowser.close();
      pdfUrl = `/reports/${pdfFilename}`;
      console.log(`[SmartRun] PDF gerado: ${pdfPath}`);
    } catch (pdfErr) {
      console.warn('[SmartRun] PDF falhou, HTML disponível:', htmlPath);
    }

    const resultJsonData = {
      success: true,
      runId,
      jobName: displayName,
      targetUrl,
      totalSteps: stepResults.length,
      approvedSteps: approved,
      failedSteps: failed,
      axeViolationsCount: axeViolations.length,
      steps: stepResults,
      generatedStepsCode: steps.map(s => s.label),
      pdfUrl,
      htmlReportUrl,
      finalScreenshot,
    };

    // 7. Salvar histórico no banco
    try {
      await supabase.from('qa_reports').insert({
        user_id: user.id,
        type: 'smart_runner',
        title: `Auditoria IA: ${displayName}`,
        input_description: `Fluxo testado em ${targetUrl}:\n${flowDescription}`,
        framework: 'playwright',
        model_used: model,
        result_raw: JSON.stringify(resultJsonData),
        result_json: resultJsonData,
      });
      console.log(`[SmartRun] Histórico salvo no Supabase.`);
    } catch (dbErr) {
      console.warn('[SmartRun] Erro ao salvar no Supabase:', dbErr);
    }

    return NextResponse.json(resultJsonData);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[SmartRun] Erro:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
