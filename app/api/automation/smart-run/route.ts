// POST /api/automation/smart-run
// Fluxo: URL + descrição (ou JSON de passos) → Playwright executa → PDF retornado

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReportHtml } from '@/lib/worker/report-generator';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

async function getChromium() {
  const pw = await import('@playwright/test');
  return pw.chromium;
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// -------------------------------------------------------
// Tipos internos
// -------------------------------------------------------
interface SmartStep {
  action: 'goto' | 'click' | 'type' | 'wait' | 'scroll' | 'hover' | 'newPage' | 'select' | 'check';
  label: string;
  selectorType?: 'role' | 'text' | 'css' | 'id' | 'context' | 'url';
  selector?: string;
  value?: string | null;
  milliseconds?: number;
  isPopup?: boolean;
}

import { tryParseDirectSteps, robustJsonParse } from '@/lib/automation/parser';

// -------------------------------------------------------
// System prompt (array to avoid SWC template-literal bug)
// -------------------------------------------------------
const SMART_RUN_SYSTEM_PROMPT = [
  'Você é um Engenheiro de Automação de QA Sênior especialista em Playwright.',
  'Sua tarefa é analisar o fluxo ou script fornecido pelo usuário e gerar um array JSON de passos de automação ALTAMENTE PRECISOS E COMPLEXOS.',
  '',
  'REGRAS AVANÇADAS:',
  '1. GRANULARIDADE EXTREMA (MÍNIMO DE 30 PASSOS): Divida a automação no maior nível de detalhe possível. Para atingir pelo menos 30 passos, adicione rolagens (scroll), interações de visualização (hover), cliques exploratórios em menus, checagem de textos auxiliares na tela, e pausas explícitas de processamento após cada etapa relevante.',
  '2. MAPEAMENTO REFINADO:',
  '   - getByRole("link",{name:"X"}) -> { "action":"click", "selectorType":"role", "selector":"link", "value":"X", "label":"Clicar no link X" }',
  '   - getByRole("button",{name:"Y"}) -> { "action":"click", "selectorType":"role", "selector":"button", "value":"Y", "label":"Clicar no botão Y" }',
  '   - fill("Z") / type -> { "action":"type", "selectorType":"css", "selector":"[seletor deduzido]", "value":"Z", "label":"Preencher campo com Z" }',
  '   - scroll / rolar -> { "action":"scroll", "label":"Rolar a página para exibir mais elementos" }',
  '3. LOCATORS ROBUSTOS: Sempre prefira `role` ou `text`. Use `css` apenas quando estritamente necessário. Nunca use XPaths frágeis.',
  '4. ESPERAS INTELIGENTES: Sempre que houver uma navegação, clique importante ou submissão, inclua obrigatoriamente um passo extra { "action":"wait", "milliseconds": 2500, "label":"Aguardar processamento e renderização da página" } logo após a ação.',
  '5. SEM NOVAS PÁGINAS: NÃO inclua a action "newPage". Se houver abertura de popup ou nova aba, trate como { "action":"wait", "milliseconds":1500, "label":"Aguardar carregamento da nova guia" }.',
  '6. LABELS PROFISSIONAIS: "label" deve ser escrito de forma técnica em português, detalhando a ação (Ex: "Acessar o portal principal", "Preencher credenciais no formulário", "Validar carregamento do modal").',
  '7. COBERTURA TOTAL E EXAUSTIVA: Expanda o script do usuário ao máximo! Adicione passos de validação visual e scroll. É OBRIGATÓRIO gerar PELO MENOS 30 passos JSON, intercalando cliques, scolls e waits.',
  '8. LIBERAÇÃO DE COOKIES: O PRIMEIRO passo de interação (logo após o "goto" e o "wait" inicial) DEVE OBRIGATORIAMENTE ser uma tentativa de aceitar cookies ou fechar banners de privacidade, mesmo que o usuário não tenha pedido. Use { "action": "click", "selectorType": "text", "selector": "Aceitar", "label": "Aceitar cookies e políticas de privacidade" }.',
  '9. RETORNO DE ABA (MUITO IMPORTANTE): Toda vez que o fluxo clicar em um link que sai da página original (como redes sociais, Facebook, WhatsApp, Twitter, etc) ou que abre uma aba nova, O PASSO SEGUINTE DEVE SER FECHAR ESSA ABA E VOLTAR PARA A ORIGINAL. Use a action especial: { "action": "closePopups", "label": "Fechar aba externa e retornar à página original" }.',
  '',
  'RESPOSTA — RETORNE APENAS ESTE JSON, NADA MAIS:',
  '{',
  '  "steps": [',
  '    { "action": "goto", "label": "Acessar o ambiente de homologação", "value": "https://..." },',
  '    { "action": "wait", "milliseconds": 2000, "label": "Aguardar carregamento inicial do DOM" },',
  '    { "action": "click", "selectorType": "text", "selector": "Aceitar", "label": "Aceitar cookies e políticas de privacidade" },',
  '    { "action": "scroll", "label": "Rolar a página para inspecionar elementos inferiores" },',
  '    { "action": "wait", "milliseconds": 1500, "label": "Aguardar renderização dos componentes" },',
  '    { "action": "click", "selectorType": "role", "selector": "button", "value": "Entrar", "label": "Acionar botão de login" },',
  '    { "action": "closePopups", "label": "Fechar abas excedentes e voltar ao fluxo principal" }',
  '  ]',
  '}',
  '',
  'IMPORTANTE: Responda ESTRITAMENTE com o JSON válido contendo o array "steps". Não inclua blocos de markdown ```json. Feche todos os objetos corretamente.',
].join('\n');

// -------------------------------------------------------
// Etapa 1: gerar passos (IA ou parse direto)
// -------------------------------------------------------
async function generateStepsFromDescription(
  targetUrl: string,
  flowDescription: string,
  model: string,
  contextImages: string[] = []
): Promise<SmartStep[]> {

  // --- Atalho: se o input já contém passos JSON, usá-los diretamente ---
  const directSteps = tryParseDirectSteps(flowDescription);
  if (directSteps) {
    console.log('[SmartRun] Usando ' + directSteps.length + ' passos do JSON fornecido diretamente (sem IA).');
    // Normalize: newPage -> wait, screenshot -> wait
    return directSteps.map(s => {
      const action = s.action as string;
      if (action === 'newPage' || action === 'screenshot') {
        return { ...s, action: 'wait' as const, milliseconds: 1000 };
      }
      return s as unknown as SmartStep;
    });
  }

  const modelMap: Record<string, string> = {
    'auto-free':      'openrouter/auto',
    'nemotron-super': 'nvidia/nemotron-3-super-120b-a12b:free',
    'laguna-xs':      'poolside/laguna-xs-2.1:free',
    'gpt-oss':        'openai/gpt-oss-20b:free',
    'cohere-north':   'cohere/north-mini-code:free',
    'qwen-coder':     'qwen/qwen-2.5-coder-32b-instruct:free',
    'kimi-k2':        'moonshotai/kimi-k2',
  };
  const llmModel = modelMap[model] || 'openrouter/auto';

  const userPrompt = 'URL: ' + targetUrl + '\n\nFluxo/Código fornecido:\n' + flowDescription + '\n\nConverter em passos JSON.';

  if (!OPENROUTER_API_KEY) {
    return [
      { action: 'goto', label: 'Acessar ' + targetUrl, value: targetUrl },
      { action: 'wait', label: 'Aguardar carregamento', milliseconds: 2000 },
    ];
  }

  let userMessageContent: any = userPrompt;
  if (contextImages && contextImages.length > 0) {
    userMessageContent = [
      { type: 'text', text: userPrompt },
      ...contextImages.map((img: string) => ({
        type: 'image_url',
        image_url: { url: img.startsWith('data:image') ? img : 'data:image/jpeg;base64,' + img },
      })),
    ];
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://planner-j53e.onrender.com',
        'X-Title': 'Planner QA Smart Runner',
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: SMART_RUN_SYSTEM_PROMPT },
          { role: 'user',   content: userMessageContent },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = (data.choices?.[0]?.message?.content || '') as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : content.replace(/```json\n?|\n?```/g, '').trim();

      try {
        if (!cleaned) throw new Error('IA retornou conteúdo vazio.');
        const parsed = robustJsonParse(cleaned);
        if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          const steps = parsed.steps as SmartStep[];
          console.log('[SmartRun] IA gerou ' + steps.length + ' passos');
          return steps.map(s => s.action === 'newPage' ? { ...s, action: 'wait' as const, milliseconds: 1000 } : s);
        }
      } catch (parseErr) {
        console.error('[SmartRun] Falha ao parsear JSON da IA (500 chars):', cleaned?.slice(0, 500));
        throw parseErr;
      }
    }
  } catch (err) {
    console.error('[SmartRun] Falha ao gerar passos via IA:', err);
  }

  // Fallback
  return [
    { action: 'goto', label: 'Acessar ' + targetUrl, value: targetUrl },
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
      '#lgpd-accept',
      '#btn-accept-cookie',
    ];
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        await btn.click({ timeout: 800 }).catch(() => {});
        await page.waitForTimeout(300);
        console.log('[SmartRun] Banner de cookies aceito: ' + sel);
        break;
      }
    }
  } catch { /* ignore */ }
}

async function runStep(page: any, step: SmartStep, index: number, baseUrl: string): Promise<StepResult> {
  const start = Date.now();
  let screenshotBase64: string | undefined;

  const getActivePage = () => {
    const pages = page.context().pages();
    return pages[pages.length - 1] || page;
  };

  const takeScreenshot = async (pageToShoot?: any): Promise<string | undefined> => {
    try {
      const p = pageToShoot || getActivePage();
      
      // Traz a aba correta para frente para o screenshot não ficar escondido
      await p.bringToFront().catch(() => {});

      // Força a espera do carregamento e do rendering do JS para sites lentos
      await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(2500);
      
      // Tira o print da aba específica
      const buf = await p.screenshot({ type: 'jpeg', quality: 70, timeout: 8000 });
      return (buf as Buffer).toString('base64');
    } catch { return undefined; }
  };

  try {
    const activePage = getActivePage();

    if (step.action === 'goto') {
      const dest = step.value || baseUrl;
      await activePage.goto(dest, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await autoAcceptCookies(activePage);
      await activePage.waitForTimeout(1000);
      screenshotBase64 = await takeScreenshot(activePage);
      return { index, label: step.label, status: 'aprovado', detalhe: 'Navegou para: ' + dest, screenshotBase64, duration: Date.now() - start };
    }

    if (step.action === 'wait' || step.action === 'newPage') {
      const ms = step.milliseconds || 1500;
      await activePage.waitForTimeout(ms);
      screenshotBase64 = await takeScreenshot(activePage);
      return { index, label: step.label, status: 'aprovado', detalhe: 'Aguardou ' + ms + 'ms', screenshotBase64, duration: Date.now() - start };
    }

    if (step.action === 'scroll') {
      await activePage.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
      await activePage.waitForTimeout(800);
      screenshotBase64 = await takeScreenshot(activePage);
      return { index, label: step.label, status: 'aprovado', detalhe: 'Rolagem executada.', screenshotBase64, duration: Date.now() - start };
    }

    // Action Customizada: closePopups
    if (step.action as any === 'closePopups') {
      const pages = page.context().pages();
      let closed = 0;
      if (pages.length > 1) {
        // Fecha da mais recente até sobrar só a original (pages[0])
        for (let i = pages.length - 1; i > 0; i--) {
          await pages[i].close().catch(() => {});
          closed++;
        }
      }
      await page.bringToFront().catch(() => {});
      screenshotBase64 = await takeScreenshot(page);
      return { 
        index, label: step.label, status: 'aprovado', 
        detalhe: closed > 0 ? `Fechou ${closed} aba(s) externa(s).` : 'Nenhuma aba externa para fechar.', 
        screenshotBase64, duration: Date.now() - start 
      };
    }

    // Build locator across all open pages (newest to oldest)
    let locator: any;
    let targetPage = activePage;
    
    const pages = page.context().pages();
    for (let i = pages.length - 1; i >= 0; i--) {
      const p = pages[i];
      let tempLoc: any;
      switch (step.selectorType) {
        case 'role': tempLoc = p.getByRole(step.selector as any, step.value ? { name: step.value } : {}); break;
        case 'text': tempLoc = p.getByText(step.value || step.selector || '', { exact: false }); break;
        case 'id': tempLoc = p.locator('#' + step.selector); break;
        default: tempLoc = p.locator(step.selector || 'body');
      }
      tempLoc = tempLoc.first();
      // If we find the element and it's attached to DOM, use this page!
      if (await tempLoc.count().catch(() => 0) > 0) {
        locator = tempLoc;
        targetPage = p;
        break;
      }

      // Robustness: Se tentou por 'role' e não achou, pode ser que a IA (ou usuário) tenha 
      // errado o role (ex: era link mas colocou button). Vamos tentar via getByText na mesma aba!
      if (step.selectorType === 'role' && step.value) {
        let fallbackLoc = p.getByText(step.value, { exact: false }).first();
        if (await fallbackLoc.count().catch(() => 0) > 0) {
          locator = fallbackLoc;
          targetPage = p;
          break;
        }
      }
    }

    if (!locator) {
      // Fallback final na página ativa (vai falhar e disparar timeout naturalmente se não existir)
      switch (step.selectorType) {
        case 'role': locator = activePage.getByRole(step.selector as any, step.value ? { name: step.value } : {}); break;
        case 'text': locator = activePage.getByText(step.value || step.selector || '', { exact: false }); break;
        case 'id': locator = activePage.locator('#' + step.selector); break;
        default: locator = activePage.locator(step.selector || 'body');
      }
      locator = locator.first();
    }

    await autoAcceptCookies(targetPage);
    await locator.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});

    // Highlight
    const originalStyle = await locator.evaluate((el: HTMLElement) => {
      const old = { shadow: el.style.boxShadow, outline: el.style.outline, transition: el.style.transition };
      el.style.transition = 'none';
      el.style.setProperty('box-shadow', '0 0 0 4px #ef4444, 0 0 20px rgba(239,68,68,0.8)', 'important');
      el.style.setProperty('outline', '3px solid #ef4444', 'important');
      el.style.setProperty('outline-offset', '3px', 'important');
      return old;
    }).catch(() => null);

    await activePage.waitForTimeout(400);

    if (originalStyle) {
      await locator.evaluate((el: HTMLElement, old: any) => {
        el.style.transition = old.transition || '';
        el.style.boxShadow = old.shadow || '';
        el.style.outline = old.outline || '';
      }, originalStyle).catch(() => {});
    }

    if (step.action === 'type') {
      await locator.fill(step.value || '', { timeout: 8000 });
      await targetPage.waitForTimeout(500);
    } else if (step.action === 'hover') {
      await locator.hover({ timeout: 8000 });
      await targetPage.waitForTimeout(600);
    } else {
      if (step.isPopup) {
        const popup = targetPage.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
        await locator.click({ force: true, timeout: 5000 });
        await popup;
      } else {
        await locator.click({ force: true, timeout: 5000 });
      }
      await Promise.race([
        targetPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
        targetPage.waitForTimeout(1500),
      ]);
    }

    screenshotBase64 = await takeScreenshot(targetPage);

    const activeUrl = targetPage.context().pages().slice(-1)[0].url();
    let detalhe = step.action === 'type'
      ? 'Digitado: "' + step.value + '" no campo.'
      : step.action === 'hover'
      ? 'Hover realizado com sucesso.'
      : 'Clique executado.';
      
    if (activeUrl !== baseUrl && activeUrl !== 'about:blank') {
      detalhe += ` ➡️ Nova página: ${activeUrl}`;
    }

    return { index, label: step.label, status: 'aprovado', detalhe, screenshotBase64, duration: Date.now() - start };

  } catch (err: unknown) {
    const fallbackPage = getActivePage();
    screenshotBase64 = await takeScreenshot(fallbackPage).catch(() => undefined);
    try {
      await fallbackPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message.split('\n')[0].substring(0, 200) : String(err);
    return { index, label: step.label, status: 'falha_clique', detalhe: 'Falha: ' + msg, screenshotBase64, duration: Date.now() - start };
  }
}

// -------------------------------------------------------
// Route Handler — POST
// -------------------------------------------------------
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const logToStream = async (message: string) => {
    console.log(message);
    try { await writer.write(encoder.encode(JSON.stringify({ type: 'log', message }) + '\n')); } catch (e) {}
  };

  (async () => {
    let browser: any;
    const runId = randomUUID();

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nao autorizado');

      const body = await req.json();
      const { targetUrl, flowDescription, jobName, model = 'auto-free', includeAxe = true, contextImages = [] } = body;

      if (!targetUrl || !flowDescription) {
        throw new Error('targetUrl e flowDescription sao obrigatorios');
      }

      await logToStream('[SmartRun] Iniciando analise de fluxo para: ' + targetUrl);
      const steps = await generateStepsFromDescription(targetUrl, flowDescription, model, contextImages);
      await logToStream('[SmartRun] ' + steps.length + ' passos gerados.');

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

      let axeViolations: any[] = [];
      if (includeAxe) {
        try {
          await logToStream('[SmartRun] Executando auditoria de acessibilidade Axe...');
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const { default: AxeBuilder } = await import('@axe-core/playwright');
          const axeResult = await (new (AxeBuilder as any)({ page }))
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          axeViolations = axeResult.violations;
          await logToStream('[SmartRun] Axe encontrou ' + axeViolations.length + ' violacoes.');
        } catch (e) {
          await logToStream('[SmartRun] Auditoria Axe falhou: ' + String(e));
        }
      }

      const stepResults: StepResult[] = [];
      for (let i = 0; i < steps.length; i++) {
        await logToStream('[SmartRun] Passo ' + (i + 1) + '/' + steps.length + ': ' + steps[i].label);
        const r = await runStep(page, steps[i], i + 1, targetUrl);
        await logToStream(' -> ' + (r.status === 'aprovado' ? 'Aprovado' : 'Falhou') + ' - ' + r.detalhe);
        stepResults.push(r);
      }

      let finalScreenshot: string | undefined;
      try {
        await logToStream('[SmartRun] Capturando screenshot final da pagina...');
        const buf = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
        finalScreenshot = buf.toString('base64');
      } catch { /* optional */ }

      await context.close();

      const approved   = stepResults.filter(r => r.status === 'aprovado').length;
      const failed     = stepResults.filter(r => r.status !== 'aprovado').length;
      const displayName = jobName || 'Auditoria de ' + new URL(targetUrl).hostname;

      await logToStream('[SmartRun] Gerando relatorios HTML e PDF...');
      const htmlContent = buildReportHtml({ results: stepResults, axeViolations, targetUrl, jobName: displayName });

      const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

      const htmlFilename = 'smart-' + runId + '.html';
      const htmlPath = path.join(reportsDir, htmlFilename);
      fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

      let pdfUrl: string | undefined;
      const htmlReportUrl = '/reports/' + htmlFilename;

      try {
        const pdfBrowser = await (await getChromium()).launch({ headless: true, args: ['--no-sandbox'] });
        const pdfPage = await pdfBrowser.newPage();
        await pdfPage.setContent(htmlContent, { waitUntil: 'networkidle', timeout: 30000 });
        const pdfFilename = 'smart-' + runId + '.pdf';
        const pdfPath = path.join(reportsDir, pdfFilename);
        await pdfPage.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
        await pdfBrowser.close();
        pdfUrl = '/reports/' + pdfFilename;
        await logToStream('[SmartRun] PDF salvo com sucesso.');
      } catch (pdfErr) {
        await logToStream('[SmartRun] Geracao de PDF falhou, HTML disponivel.');
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

      try {
        await supabase.from('qa_reports').insert({
          user_id: user.id,
          type: 'smart_runner',
          title: 'Auditoria IA: ' + displayName,
          input_description: 'Fluxo testado em ' + targetUrl + ':\n' + flowDescription,
          framework: 'playwright',
          model_used: model,
          result_raw: JSON.stringify(resultJsonData),
          result_json: resultJsonData,
        });
        await logToStream('[SmartRun] Historico salvo no Supabase.');
      } catch (dbErr) {
        await logToStream('[SmartRun] Falha ao salvar no historico do BD: ' + String(dbErr));
      }

      await logToStream('[SmartRun] Teste concluido!');
      await writer.write(encoder.encode(JSON.stringify({ type: 'result', data: resultJsonData }) + '\n'));

    } catch (err: any) {
      console.error('[SmartRun Error]', err);
      try {
        await writer.write(encoder.encode(JSON.stringify({ type: 'error', error: err.message || 'Erro interno' }) + '\n'));
      } catch (e) {}
    } finally {
      if (browser) await browser.close().catch(() => {});
      try { await writer.close(); } catch (e) {}
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    },
  });
}
