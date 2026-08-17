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

import { tryParseDirectSteps, robustJsonParse, parsePortugueseRoteiro } from '@/lib/automation/parser';

// -------------------------------------------------------
// System prompt (array to avoid SWC template-literal bug)
// -------------------------------------------------------
const SMART_RUN_SYSTEM_PROMPT = [
  'Você é um Engenheiro de Automação de QA Sênior especialista em Playwright.',
  'Sua tarefa é analisar o fluxo ou script fornecido pelo usuário e gerar um array JSON de passos de automação ALTAMENTE PRECISOS E COMPLEXOS.',
  '',
  'REGRAS AVANÇADAS:',
  '1. GRANULARIDADE E PRECISÃO: Divida a automação no nível de detalhe adequado. Adicione pausas explícitas de processamento após etapas que exigem navegação ou carregamento. NÃO crie passos fictícios apenas para alongar o teste.',
  '2. MAPEAMENTO REFINADO:',
  '   - getByRole("link",{name:"X"}) -> { "action":"click", "selectorType":"role", "selector":"link", "value":"X", "label":"Clicar no link X" }',
  '   - getByRole("button",{name:"Y"}) -> { "action":"click", "selectorType":"role", "selector":"button", "value":"Y", "label":"Clicar no botão Y" }',
  '   - fill("Z") / type -> { "action":"type", "selectorType":"css", "selector":"[seletor deduzido]", "value":"Z", "label":"Preencher campo com Z" }',
  '   - scroll / rolar -> { "action":"scroll", "label":"Rolar a página para exibir mais elementos" }',
  '3. LOCATORS ROBUSTOS: Sempre prefira `role` ou `text`. Use `css` apenas quando estritamente necessário. Nunca use XPaths frágeis.',
  '4. ESPERAS INTELIGENTES: Sempre que houver uma navegação, clique importante ou submissão, inclua obrigatoriamente um passo extra { "action":"wait", "milliseconds": 2500, "label":"Aguardar processamento e renderização da página" } logo após a ação.',
  '5. SEM NOVAS PÁGINAS: NÃO inclua a action "newPage". Se houver abertura de popup ou nova aba, trate como { "action":"wait", "milliseconds":1500, "label":"Aguardar carregamento da nova guia" }.',
  '6. LABELS PROFISSIONAIS: "label" deve ser escrito de forma técnica em português, detalhando a ação (Ex: "Acessar o portal principal", "Preencher credenciais no formulário", "Validar carregamento do modal").',
  '7. FOCO FUNCIONAL: Foque em mapear interações reais (links importantes, botões de ação, formulários). Evite adicionar dezenas de cliques em textos não interativos ou widgets de feedback irrelevantes.',
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
  '10. IDIOMA OBRIGATÓRIO: Você deve responder EXCLUSIVAMENTE em Português do Brasil (PT-BR), inclusive nos labels.',
  '',
  '11. COBERTURA TOTAL DO ROTEIRO (CRÍTICO): Se o usuário fornecer passos numerados (ex: "1. Clicar em X", "2. Preencher Y"), você DEVE gerar um step de interação para CADA passo numerado, sem exceção. Gerar apenas goto+wait quando houver passos é PROIBIDO.',
  '',
  'IMPORTANTE: Responda ESTRITAMENTE com o JSON válido contendo o array "steps". Não inclua blocos de markdown ```json. Feche todos os objetos corretamente.',
].join('\n');

// -------------------------------------------------------
// Etapa 1: gerar passos (IA ou parse direto)
// -------------------------------------------------------
export async function generateStepsFromDescription(
  targetUrl: string,
  flowDescription: string,
  model: string,
  contextImages: string[] = []
): Promise<SmartStep[]> {

  // --- Prioridade 1: se o input contém passos JSON, Playwright TS/JS ou Roteiro PT-BR ---
  const directSteps = tryParseDirectSteps(flowDescription, targetUrl);
  if (directSteps && directSteps.length > 0) {
    console.log('[SmartRun] Usando ' + directSteps.length + ' passos detectados nativamente (sem IA).');
    return directSteps.map(s => {
      const action = s.action as string;
      if (action === 'newPage' || action === 'screenshot') {
        return { ...s, action: 'wait', milliseconds: 1000 } as unknown as SmartStep;
      }
      return s as unknown as SmartStep;
    });
  }

  // Nota: roteiros em texto PT-BR numerados SÃO INTENCIONALMENTE enviados para a IA.
  // O parsePortugueseRoteiro só é usado como último fallback (quando a IA não está disponível).

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

  // Build a structured, explicit prompt so the AI maps EVERY numbered step in the roteiro OR translates the script
  const userPrompt = [
    '== CONTEXTO ==',
    'Você está automatizando um caso de teste de QA para a URL: ' + targetUrl,
    '',
    '== ROTEIRO / SCRIPT FORNECIDO ==',
    flowDescription,
    '',
    '== SUA TAREFA ==',
    'Leia o roteiro ou script fornecido acima (que pode ser uma lista numerada em texto ou um código Playwright/Typescript) e converta as interações em um array JSON.',
    'REGRAS OBRIGATÓRIAS:',
    '- Se for uma lista numerada: Não omita NENHUM passo. Gere um step de interação para cada passo.',
    '- Se for um código (Playwright, Puppeteer, etc): Extraia cada ação do código (page.goto, click, fill, type, etc) e gere o step correspondente.',
    '- Para "click" -> action:"click", selectorType:"text" ou "role", selector/value = texto ou seletor do elemento.',
    '- Para "fill"/"type" -> action:"type", selector = seletor do campo, value = texto preenchido.',
    '- Para navegação -> action:"goto", value = URL.',
    '- Sempre inclua um action:"wait" de 1500ms após cada clique ou navegação.',
    '- O primeiro step deve ser action:"goto" com a URL: ' + targetUrl,
    '',
    'Gere EXATAMENTE o JSON com o array "steps" cobrindo TODAS as interações do script ou roteiro.',
  ].join('\n');

  if (!OPENROUTER_API_KEY && !process.env.GROQ_API_KEY) {
    const roteiroSteps = parsePortugueseRoteiro(flowDescription, targetUrl);
    if (roteiroSteps && roteiroSteps.length > 0) {
      return roteiroSteps as unknown as SmartStep[];
    }
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
          console.log('[SmartRun] IA gerou ' + steps.length + ' passos via OpenRouter');
          return steps.map(s => s.action === 'newPage' ? { ...s, action: 'wait' as const, milliseconds: 1000 } : s);
        }
      } catch (parseErr) {
        console.error('[SmartRun] Falha ao parsear JSON da IA (500 chars):', cleaned?.slice(0, 500));
        throw parseErr;
      }
    } else {
      console.warn('[SmartRun] Falha na API do OpenRouter:', res.status, await res.text());
      throw new Error("OpenRouter API Failed");
    }
  } catch (err) {
    console.error('[SmartRun] Falha ao gerar passos via IA (OpenRouter). Tentando fallback para Groq...', err);
    
    // --- Groq Fallback ---
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        console.log("[SmartRun] Tentando Groq fallback (llama-3.3-70b-versatile)...");
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + groqKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            model: "llama-3.3-70b-versatile", 
            messages: [
              { role: 'system', content: SMART_RUN_SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt + (contextImages?.length > 0 ? '\n\n[Nota: Imagens fornecidas foram omitidas pois este modelo não suporta visão]' : '') },
            ],
            temperature: 0.1, 
            max_tokens: 4000,
          }),
        });
        
        if (groqRes.ok) {
          const data = await groqRes.json();
          const content = (data.choices?.[0]?.message?.content || '') as string;
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const cleaned = jsonMatch ? jsonMatch[0] : content.replace(/```json\n?|\n?```/g, '').trim();

          const parsed = robustJsonParse(cleaned);
          if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
            const steps = parsed.steps as SmartStep[];
            console.log('[SmartRun] IA gerou ' + steps.length + ' passos via Groq');
            return steps.map(s => s.action === 'newPage' ? { ...s, action: 'wait' as const, milliseconds: 1000 } : s);
          }
        }
      } catch (groqErr) {
        console.error('[SmartRun] Falha ao gerar passos via Groq:', groqErr);
      }
    }
  }

  // --- Último fallback: Parser determinístico de roteiro PT-BR (sem IA) ---
  const roteiroSteps = parsePortugueseRoteiro(flowDescription, targetUrl);
  if (roteiroSteps && roteiroSteps.length > 0) {
    console.log('[SmartRun] Roteiro PT-BR parseado deterministicamente (fallback sem IA): ' + roteiroSteps.length + ' steps.');
    return roteiroSteps as unknown as SmartStep[];
  }

  // Fallback mínimo
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
  screenshotBeforeBase64?: string;
  screenshotElementBase64?: string;
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

async function runStep(page: any, step: SmartStep, index: number, baseUrl: string, lastScreenshotRef: { hash: string }): Promise<StepResult> {
  const start = Date.now();
  let screenshotBase64: string | undefined;
  let screenshotBeforeBase64: string | undefined;
  let screenshotElementBase64: string | undefined;
  const lower = (step.label || '').toLowerCase();

  // `page` is always the ORIGINAL page (first tab). We use it as the anchor.
  const getActivePage = () => {
    const pages = page.context().pages();
    return pages[pages.length - 1] || page;
  };

  /** Close all tabs except the original one and bring it back to front */
  const closeExtraTabs = async () => {
    try {
      const pages = page.context().pages();
      if (pages.length > 1) {
        for (let i = pages.length - 1; i > 0; i--) {
          await pages[i].close().catch(() => {});
        }
      }
      await page.bringToFront().catch(() => {});
    } catch { /* ignore */ }
  };

  const takeScreenshot = async (pageToShoot?: any, locatorToShoot?: any, force = false, fullPage = false): Promise<string | undefined> => {
    try {
      if (locatorToShoot) {
        const buf = await locatorToShoot.screenshot({ type: 'jpeg', quality: 95, timeout: 8000 });
        return (buf as Buffer).toString('base64');
      }

      const p = pageToShoot || getActivePage();
      await p.bringToFront().catch(() => {});

      // Garante que o CSS, fontes e estilos estejam 100% renderizados antes da foto
      await p.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
      await p.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve()).catch(() => {});
      await p.waitForTimeout(400);
      
      // Print em Alta Definição (HD - Quality 95)
      const buf = await p.screenshot({ type: 'jpeg', quality: 95, fullPage, timeout: 15000 });
      return (buf as Buffer).toString('base64');
    } catch { return undefined; }
  };

  // Track URL before action to detect "false failures" where click actually worked
  let urlBeforeAction = '';
  try { urlBeforeAction = page.url(); } catch { /* ignore */ }

  try {
    // Always prefer the ORIGINAL page for interactions (except goto to same domain)
    const activePage = page;

    if (step.action === 'goto') {
      const dest = step.value || baseUrl;
      
      let absoluteDest = dest;
      try {
        absoluteDest = new URL(dest, baseUrl).href;
      } catch { /* ignore */ }

      // Check if destination is on a different domain than the base URL
      let isExternal = false;
      try {
        isExternal = new URL(absoluteDest).hostname !== new URL(baseUrl).hostname;
      } catch { /* invalid URL, treat as internal */ }

      if (isExternal) {
        // External URLs: open in a NEW tab, screenshot, close — keep original page intact
        let externalPage: any;
        try {
          externalPage = await page.context().newPage();
          await externalPage.goto(absoluteDest, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          screenshotBase64 = await takeScreenshot(externalPage, undefined, true); // Forçar print por ser aba externa
          await externalPage.close();
        } catch { }
        return { index, label: step.label, status: 'aprovado', detalhe: 'Navegou (aba externa) para: ' + absoluteDest, screenshotBase64, duration: Date.now() - start };
      }

      // Strategy 1: load / domcontentloaded
      let gotoRes = await activePage.goto(absoluteDest, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch((e: any) => e);
      
      // Strategy 2: If failed, retry with 'commit' (just waits for first byte)
      if (gotoRes instanceof Error) {
        console.log('[SmartRun] Retry com estratégia commit para: ' + absoluteDest);
        gotoRes = await activePage.goto(absoluteDest, { waitUntil: 'commit', timeout: 20000 }).catch((e: any) => e);
      }

      if (gotoRes instanceof Error) {
        // Page failed — capture whatever is visible (might be a partial load or error page)
        screenshotBase64 = await takeScreenshot(activePage, undefined, true).catch(() => undefined);
        return { 
          index, label: step.label, 
          status: 'falha_clique', 
          detalhe: 'Falha ao carregar ' + absoluteDest + ' — ' + gotoRes.message.split('\n')[0], 
          screenshotBase64,
          duration: Date.now() - start 
        };
      }
      
      await autoAcceptCookies(activePage);
      // Aguarda carregar as fontes e folhas de estilo CSS
      await activePage.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve()).catch(() => {});
      await activePage.waitForTimeout(800);

      screenshotBase64 = await takeScreenshot(activePage, undefined, true);
      return { index, label: step.label, status: 'aprovado', detalhe: 'Navegou para: ' + absoluteDest, screenshotBase64, duration: Date.now() - start };
    }

    if (step.action === 'wait') {
      const ms = step.milliseconds || 2000;
      await activePage.waitForTimeout(ms);
      screenshotBase64 = await takeScreenshot(activePage);
      return { index, label: step.label, status: 'aprovado', detalhe: 'Aguardou ' + ms + 'ms', screenshotBase64, duration: Date.now() - start };
    }

    if (step.action === 'scroll') {
      await activePage.mouse.wheel(0, 800);
      await activePage.waitForTimeout(800);
      screenshotBase64 = await takeScreenshot(activePage);
      return { index, label: step.label, status: 'aprovado', detalhe: 'Rolagem executada.', screenshotBase64, duration: Date.now() - start };
    }

    if (step.action as any === 'closePopups') {
      const pages = page.context().pages();
      let closed = 0;
      if (pages.length > 1) {
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

    // Before searching for an element, close leftover popup tabs so we focus on the original page
    await closeExtraTabs();

    // If the original page somehow ended up on an external domain, navigate back
    try {
      const pageUrl = page.url();
      if (pageUrl && !pageUrl.startsWith('chrome-error:') && !pageUrl.startsWith('about:')) {
        const currentHost = new URL(pageUrl).hostname;
        const baseHost = new URL(baseUrl).hostname;
        if (currentHost && baseHost && currentHost !== baseHost && currentHost !== 'chromewebdata') {
          console.log('[SmartRun] Página original saiu do domínio (' + currentHost + '), voltando para ' + baseUrl);
          await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    } catch { /* ignore */ }

    // Helper: build a locator for a step on a given page
    const buildLocator = (p: any) => {
      let loc: any;
      switch (step.selectorType) {
        case 'role': loc = p.getByRole(step.selector as any, step.value ? { name: step.value } : {}); break;
        case 'text': loc = p.getByText(step.value || step.selector || '', { exact: false }); break;
        case 'id': loc = p.locator('#' + step.selector); break;
        default: loc = p.locator(step.selector || 'body');
      }
      return loc.first();
    };

    // Build locator — search on original page first
    let locator: any;
    let targetPage = activePage;
    
    // Try original page first
    let tempLoc = buildLocator(activePage);
    if (await tempLoc.count().catch(() => 0) > 0) {
      locator = tempLoc;
    }

    // Fallback 1: try getByText if role search failed
    if (!locator && step.selectorType === 'role' && step.value) {
      let fallbackLoc = activePage.getByText(step.value, { exact: false }).first();
      if (await fallbackLoc.count().catch(() => 0) > 0) {
        locator = fallbackLoc;
      }
    }

    // Fallback 2: try generic CSS attributes (aria-label, title, alt) for icons/links
    if (!locator && step.value) {
      // Escape quotes in step.value just in case
      const safeValue = step.value.replace(/"/g, '\\"');
      const cssFallback = `[aria-label*="${safeValue}" i], [title*="${safeValue}" i], img[alt*="${safeValue}" i], a:has-text("${safeValue}")`;
      let fb = activePage.locator(cssFallback).first();
      if (await fb.count().catch(() => 0) > 0) {
         locator = fb;
      }
    }

    // Fallback 3: Semantic Fallbacks for Login fields (Email, Senha, Botão Entrar)
    if (!locator || (await locator.count().catch(() => 0)) === 0) {
      const stepText = ((step.selector || '') + ' ' + (step.label || '') + ' ' + (step.value || '')).toLowerCase();

      if (step.action === 'type') {
        if (stepText.includes('email') || stepText.includes('e-mail') || stepText.includes('usuario') || stepText.includes('usuário') || stepText.includes('login')) {
          const emailFb = activePage.locator('input[type="email"], input[name*="email" i], input[name*="user" i], input[name*="login" i], input[placeholder*="email" i], input[placeholder*="e-mail" i], input[id*="email" i], input[id*="user" i]').first();
          if (await emailFb.count().catch(() => 0) > 0) {
            locator = emailFb;
          } else {
            // First available text input on the page
            const firstInput = activePage.locator('input[type="text"], input:not([type="password"]):not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])').first();
            if (await firstInput.count().catch(() => 0) > 0) {
              locator = firstInput;
            }
          }
        } else if (stepText.includes('senha') || stepText.includes('password') || stepText.includes('pass')) {
          const passFb = activePage.locator('input[type="password"], input[name*="pass" i], input[name*="senha" i], input[placeholder*="senha" i], input[placeholder*="password" i], input[id*="pass" i], input[id*="senha" i]').first();
          if (await passFb.count().catch(() => 0) > 0) {
            locator = passFb;
          }
        }
      } else if (step.action === 'click') {
        if (stepText.includes('entrar') || stepText.includes('login') || stepText.includes('submeter') || stepText.includes('acessar') || stepText.includes('plataforma')) {
          const btnFb = activePage.locator('button:has-text("Entrar na plataforma"), button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button[type="submit"], input[type="submit"], [data-testid*="login" i], [data-testid*="submit" i]').first();
          if (await btnFb.count().catch(() => 0) > 0) {
            locator = btnFb;
          }
        }
      }
    }

    // Fallback: try on other open pages (rare, but just in case)
    if (!locator) {
      const pages = page.context().pages();
      for (let i = pages.length - 1; i >= 1; i--) {
        const p = pages[i];
        tempLoc = buildLocator(p);
        if (await tempLoc.count().catch(() => 0) > 0) {
          locator = tempLoc;
          targetPage = p;
          break;
        }
        if (step.selectorType === 'role' && step.value) {
          let fb = p.getByText(step.value, { exact: false }).first();
          if (await fb.count().catch(() => 0) > 0) {
            locator = fb;
            targetPage = p;
            break;
          }
        }
      }
    }

    if (!locator) {
      // Last resort: use original page locator
      locator = buildLocator(activePage);
    }

    try {
      await locator.waitFor({ state: 'attached', timeout: 8000 });
    } catch {
      throw new Error(`Elemento não encontrado: ${step.selector || step.value}`);
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

    // Evidência do estado ANTES da ação (página inteira com o highlight aplicado)
    // Usa targetPage (página onde o elemento foi encontrado) — não activePage (sempre a original)
    if (step.action !== 'type' && step.action !== 'hover') {
      screenshotBeforeBase64 = await takeScreenshot(targetPage);
      
      // Também capturamos o elemento pequeno opcionalmente
      const buf = await locator.screenshot({ type: 'jpeg', quality: 80, timeout: 5000 }).catch(() => null);
      if (buf) screenshotElementBase64 = buf.toString('base64');
    }

    if (originalStyle) {
      await locator.evaluate((el: HTMLElement, old: any) => {
        el.style.transition = old.transition || '';
        el.style.boxShadow = old.shadow || '';
        el.style.outline = old.outline || '';
      }, originalStyle).catch(() => {});
    }

    // Update URL right before action to detect navigation caused by click
    urlBeforeAction = page.url();

    if (step.action === 'type') {
      await locator.fill(step.value || '', { timeout: 15000 });
      await targetPage.waitForTimeout(500);
      // Capture full-page evidence after filling (highlight the filled field)
      screenshotBase64 = await takeScreenshot(targetPage, undefined, true);
    } else if (step.action === 'hover') {
      await locator.hover({ timeout: 15000 });
      await targetPage.waitForTimeout(600);
    } else {
      // Track how many pages we have before the click
      const pageCountBefore = page.context().pages().length;

      if (step.isPopup) {
        const popup = targetPage.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
        try {
          await locator.click({ force: true, timeout: 5000 });
        } catch {
          await locator.evaluate((el: HTMLElement) => el.click()); // No catch to allow error to propagate if it fails
        }
        await popup;
      } else {
        try {
          await locator.click({ force: true, timeout: 5000 });
        } catch {
          await locator.evaluate((el: HTMLElement) => el.click());
        }
      }
      await Promise.race([
        targetPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        targetPage.waitForTimeout(1500),
      ]);

      // If the click opened new tab(s), take screenshot of the new tab then close them
      const pageCountAfter = page.context().pages().length;
      if (pageCountAfter > pageCountBefore) {
        const newestPage = page.context().pages().slice(-1)[0];
        screenshotBase64 = await takeScreenshot(newestPage);
        // Close popup tabs and return to original page
        await closeExtraTabs();
      }

      // Take screenshot of the new state before potentially navigating back
      if (!screenshotBase64) {
        screenshotBase64 = await takeScreenshot(targetPage);
      }

      // If the click navigated the original page to an external domain, go back
      try {
        const currentHost = new URL(page.url()).hostname;
        const baseHost = new URL(baseUrl).hostname;
        if (currentHost !== baseHost) {
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(async () => {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          });
          await page.waitForTimeout(500);
        }
      } catch { /* ignore */ }
    }

    if (step.action !== 'type' && step.action !== 'hover') {
      if (!screenshotBase64) {
        screenshotBase64 = await takeScreenshot(targetPage);
      }
    }

    const currentUrl = page.url();
    let detalhe = step.action === 'type'
      ? 'Digitado: "' + step.value + '" no campo.'
      : step.action === 'hover'
      ? 'Hover realizado com sucesso.'
      : 'Clique executado.';
      
    if (currentUrl !== baseUrl && currentUrl !== 'about:blank') {
      detalhe += ` ➡️ Página atual: ${currentUrl}`;
    }

    return { index, label: step.label, status: 'aprovado', detalhe, screenshotBase64, screenshotBeforeBase64, screenshotElementBase64, duration: Date.now() - start };

  } catch (err: unknown) {
    // Check if the page URL changed — if so, the action actually worked
    // (e.g., click triggered navigation but element disappeared, causing Playwright timeout)
    const urlAfterError = page.url();
    let urlChanged = false;
    try {
      urlChanged = urlAfterError !== 'about:blank' && urlAfterError !== urlBeforeAction;
    } catch { /* urlBeforeAction may not be defined if error was before click */ }

    if (urlChanged) {
      // The click actually worked! Navigation happened.
      screenshotBase64 = await takeScreenshot(page).catch(() => undefined);
      await closeExtraTabs();
      return {
        index,
        label: step.label,
        status: 'aprovado',
        detalhe: `Clique executado (com aviso de timeout). ➡️ Página atual: ${urlAfterError}`,
        screenshotBase64, screenshotBeforeBase64, screenshotElementBase64,
        duration: Date.now() - start,
      };
    }

    // Check if new tabs were opened — click worked but opened a popup
    const pagesAfterError = page.context().pages().length;
    if (pagesAfterError > 1) {
      const newestPage = page.context().pages().slice(-1)[0];
      const popupUrl = newestPage.url();
      screenshotBase64 = await takeScreenshot(newestPage).catch(() => undefined);
      await closeExtraTabs();
      if (popupUrl && popupUrl !== 'about:blank') {
        return {
          index,
          label: step.label,
          status: 'aprovado',
          detalhe: `Clique abriu nova aba: ${popupUrl}`,
          screenshotBase64, screenshotBeforeBase64, screenshotElementBase64,
          duration: Date.now() - start,
        };
      }
    }

    // Real failure — close extra tabs and recover
    // Force a full-page screenshot on failure to provide better context
    screenshotBase64 = screenshotBase64 || await takeScreenshot(page, undefined, false, true).catch(() => undefined);
    try {
      await closeExtraTabs();
      const currentUrl = page.url();
      let needsNav = true;
      try { needsNav = new URL(currentUrl).hostname !== new URL(baseUrl).hostname; } catch { /* navigate */ }
      if (needsNav || currentUrl === 'about:blank') {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      }
    } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message.split('\n')[0].substring(0, 200) : String(err);
    // Retorna falha real para que o relatório reflita o estado verdadeiro do teste
    return { index, label: step.label, status: 'falha_clique', detalhe: 'Falha: ' + msg, screenshotBase64, screenshotBeforeBase64, screenshotElementBase64, duration: Date.now() - start };
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
      const { targetUrl, flowDescription, jobName, model = 'auto-free', includeAxe = true, contextImages = [], testType = 'smart_ai', preCompiledSteps } = body;

      if (!targetUrl) {
        throw new Error('targetUrl é obrigatorio');
      }
      if (testType === 'smart_ai' && !flowDescription && !preCompiledSteps) {
        throw new Error('flowDescription ou preCompiledSteps é obrigatorio para testes de IA');
      }

      await logToStream(`[SmartRun] Iniciando teste (${testType}) para: ` + targetUrl);
      
      let steps: SmartStep[] = [];
      if (testType === 'smart_ai') {
        if (preCompiledSteps && Array.isArray(preCompiledSteps)) {
          steps = preCompiledSteps;
          await logToStream('[SmartRun] Usando ' + steps.length + ' passos pré-compilados e validados pelo usuário.');
        } else {
          steps = await generateStepsFromDescription(targetUrl, flowDescription, model, contextImages);
          await logToStream('[SmartRun] ' + steps.length + ' passos extraídos/gerados.');
        }
      }
      
      const typeLabelMap: Record<string, string> = {
        smart_ai: 'IA',
        accessibility: 'Acessibilidade',
        seo: 'SEO',
        broken_links: 'Links Quebrados'
      };
      const displayName = jobName || `Auditoria ${typeLabelMap[testType] || testType}: ` + new URL(targetUrl).hostname;
      let reportId: string | null = null;

      try {
        const { data: insertedReport, error } = await supabase.from('qa_reports').insert({
          user_id: user.id,
          type: 'smart_runner',
          title: 'Auditoria IA (Rodando): ' + displayName,
          input_description: (testType === 'smart_ai' ? 'Fluxo testado em ' + targetUrl + ':\n' + flowDescription : `Teste Automático (${typeLabelMap[testType]}) em ${targetUrl}`),
          framework: 'playwright',
          model_used: model,
          result_raw: JSON.stringify({ success: false, status: 'running', jobName: displayName }),
          result_json: { success: false, status: 'running', jobName: displayName },
        }).select('id').single();
        if (!error && insertedReport) {
           reportId = insertedReport.id;
           await logToStream('[SmartRun] Teste registrado em background com ID: ' + reportId);
        }
      } catch (dbErr) {
         await logToStream('[SmartRun] Falha inicial ao registrar no BD: ' + String(dbErr));
      }

      const chromium = await getChromium();
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--font-render-hinting=medium',
          '--enable-font-antialiasing',
        ],
      });

      const context = await browser.newContext({
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        viewport: { width: 1366, height: 850 },
        deviceScaleFactor: 2, // 2x Retina / Alta Definição para prints perfeitos e nítidos
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
      });

      // Remove navigator.webdriver fingerprint
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        (window as any).chrome = { runtime: {} };
      });

      const page = await context.newPage();
      await page.addInitScript(() => { window.print = () => {}; });

      let axeViolations: any[] = [];
      if (includeAxe) {
        try {
          await logToStream('[SmartRun] Executando auditoria de acessibilidade (Axe Core + HTMLCS)...');
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const { default: AxeBuilder } = await import('@axe-core/playwright');
          const axeResult = await (new (AxeBuilder as any)({ page }))
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          let allViolations = [...axeResult.violations];

          try {
            await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/HTML_CodeSniffer/2.5.1/HTMLCS.min.js' });
            const htmlcsMsgs = await page.evaluate(() => {
              return new Promise<any[]>((resolve) => {
                if (!(window as any).HTMLCS) { resolve([]); return; }
                (window as any).HTMLCS.process('WCAG2AA', document.documentElement, () => {
                  const msgs = (window as any).HTMLCS.getMessages();
                  resolve(msgs.map((m: any) => ({
                    type: m.type,
                    msg: m.msg,
                    code: m.code,
                    html: m.element ? m.element.outerHTML.substring(0, 200) : ''
                  })));
                });
              });
            });
            const mappedHtmlcs = htmlcsMsgs
              .filter((m: any) => m.type === 1 || m.type === 2)
              .map((m: any) => ({
                id: m.code,
                description: '[HTMLCS] ' + m.msg,
                help: 'Regra HTMLCS: ' + m.code,
                helpUrl: '',
                impact: m.type === 1 ? 'critical' : 'moderate',
                nodes: [{ html: m.html || 'Sem HTML extraído' }]
              }));
            allViolations = [...allViolations, ...mappedHtmlcs];
          } catch (htmlcsErr) {
            await logToStream('[SmartRun] HTMLCS falhou: ' + String(htmlcsErr));
          }

          axeViolations = allViolations;
          await logToStream('[SmartRun] Encontradas ' + axeViolations.length + ' violações combinadas.');
        } catch (e) {
          await logToStream('[SmartRun] Auditoria Acessibilidade falhou: ' + String(e));
        }
      }

      const stepResults: StepResult[] = [];
      const lastScreenshotRef = { hash: '' };

      if (testType === 'smart_ai') {
        // Garantir que a página está na URL alvo antes de rodar os passos se o primeiro passo não for um goto
        if (steps.length > 0 && steps[0].action !== 'goto') {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        }

        for (let i = 0; i < steps.length; i++) {
          await logToStream('[SmartRun] Passo ' + (i + 1) + '/' + steps.length + ': ' + steps[i].label);
          const r = await runStep(page, steps[i], i + 1, targetUrl, lastScreenshotRef);
          await logToStream(' -> ' + (r.status === 'aprovado' ? 'Aprovado' : 'Falhou') + ' - ' + r.detalhe);
          stepResults.push(r);
        }
      } else if (testType === 'seo') {
        await logToStream('[SmartRun] Executando verificações de SEO...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const title = await page.title();
        stepResults.push({ index: 1, label: 'Validar Tag <title>', status: title ? 'aprovado' : 'falha_clique', detalhe: title ? `Encontrado: "${title}"` : 'Ausente', duration: 100 });
        
        const desc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
        stepResults.push({ index: 2, label: 'Validar Meta Description', status: desc ? 'aprovado' : 'falha_clique', detalhe: desc ? `Encontrado: "${desc}"` : 'Ausente', duration: 50 });
        
        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
        stepResults.push({ index: 3, label: 'Validar OpenGraph Title', status: ogTitle ? 'aprovado' : 'falha_clique', detalhe: ogTitle ? `Encontrado: "${ogTitle}"` : 'Ausente', duration: 50 });
        
        const h1Count = await page.locator('h1').count();
        stepResults.push({ index: 4, label: 'Validar presença de <h1>', status: h1Count === 1 ? 'aprovado' : 'falha_clique', detalhe: h1Count === 1 ? 'Exatamente 1 <h1> encontrado.' : `${h1Count} tags <h1> encontradas (ideal: 1).`, duration: 50 });
      } else if (testType === 'broken_links') {
        await logToStream('[SmartRun] Executando verificação de links...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href));
        const uniqueLinks = Array.from(new Set(links as string[])).filter(l => l.startsWith('http')).slice(0, 15); // limit to 15 to avoid long times
        
        await logToStream(`[SmartRun] ${uniqueLinks.length} links unicos encontrados para teste.`);
        for (let i = 0; i < uniqueLinks.length; i++) {
          const url = uniqueLinks[i];
          const start = Date.now();
          let ok = false;
          let msg = '';
          try {
            const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) }));
            ok = r && r.ok;
            msg = r ? `Status ${r.status}` : 'Falha na requisição';
          } catch (e: any) {
            msg = e.message || 'Timeout/Erro';
          }
          stepResults.push({ index: i + 1, label: `Validar link: ${url.slice(0, 50)}...`, status: ok ? 'aprovado' : 'falha_clique', detalhe: msg, duration: Date.now() - start });
        }
      } else if (testType === 'accessibility') {
         stepResults.push({ index: 1, label: 'Auditoria de Acessibilidade (Axe)', status: axeViolations.length === 0 ? 'aprovado' : 'falha_clique', detalhe: axeViolations.length === 0 ? 'Nenhuma violação encontrada.' : `${axeViolations.length} violações encontradas. Veja o detalhamento no topo do relatório.`, duration: 5000 });
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
      await logToStream('[SmartRun] Gerando relatorios HTML e PDF...');
      const htmlContent = buildReportHtml({ 
        results: stepResults, 
        axeViolations, 
        targetUrl, 
        jobName: displayName,
        plannedSteps: steps.map(s => s.label)
      });

      const htmlFilename = 'smart-' + runId + '.html';
      let htmlReportUrl = '';

      try {
        const { data, error: htmlErr } = await supabase.storage.from('reports').upload(htmlFilename, htmlContent, { contentType: 'text/html', upsert: true });
        if (htmlErr) throw htmlErr;
        htmlReportUrl = supabase.storage.from('reports').getPublicUrl(htmlFilename).data.publicUrl;
        await logToStream('[SmartRun] Relatório HTML enviado para nuvem.');
      } catch (err) {
        await logToStream('[SmartRun] Falha no upload HTML para a nuvem. Salvando local: ' + String(err));
        const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        const htmlPath = path.join(reportsDir, htmlFilename);
        fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
        htmlReportUrl = '/reports/' + htmlFilename;
      }

      let pdfUrl: string | undefined;

      try {
        const pdfBrowser = await (await getChromium()).launch({ headless: true, args: ['--no-sandbox'] });
        const pdfPage = await pdfBrowser.newPage();
        await pdfPage.setContent(htmlContent, { waitUntil: 'networkidle', timeout: 30000 });
        const pdfFilename = 'smart-' + runId + '.pdf';
        
        const pdfBuffer = await pdfPage.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
        await pdfBrowser.close();

        const { error: pdfErr } = await supabase.storage.from('reports').upload(pdfFilename, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        if (pdfErr) throw pdfErr;
        
        pdfUrl = supabase.storage.from('reports').getPublicUrl(pdfFilename).data.publicUrl;
        await logToStream('[SmartRun] PDF salvo com sucesso no Supabase Storage.');
      } catch (pdfErr) {
        await logToStream('[SmartRun] Geracao de PDF ou upload falhou, HTML disponivel. ' + String(pdfErr));
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
        rawSteps: steps,
        pdfUrl,
        htmlReportUrl,
        finalScreenshot,
      };

      // Create a stripped version without heavy base64 images for the database
      const resultJsonDataForDb = { ...resultJsonData };
      delete resultJsonDataForDb.finalScreenshot;
      if (resultJsonDataForDb.steps) {
        resultJsonDataForDb.steps = resultJsonDataForDb.steps.map(s => {
          const sCopy = { ...s };
          delete sCopy.screenshotBase64;
          delete sCopy.screenshotBeforeBase64;
          return sCopy;
        });
      }

      try {
        if (reportId) {
          await supabase.from('qa_reports').update({
            title: 'Auditoria IA: ' + displayName,
            result_raw: JSON.stringify(resultJsonDataForDb),
            result_json: resultJsonDataForDb,
          }).eq('id', reportId);
          await logToStream('[SmartRun] Historico atualizado no Supabase.');
        } else {
          const { data: insertedReport, error } = await supabase.from('qa_reports').insert({
            user_id: user.id,
            type: 'smart_runner',
            title: 'Auditoria IA: ' + displayName,
            input_description: 'Fluxo testado em ' + targetUrl + ':\n' + flowDescription,
            framework: 'playwright',
            model_used: model,
            result_raw: JSON.stringify(resultJsonDataForDb),
            result_json: resultJsonDataForDb,
          }).select('id').single();
          if (!error && insertedReport) {
            reportId = insertedReport.id;
          }
          await logToStream('[SmartRun] Historico salvo no Supabase.');
        }
      } catch (dbErr) {
        await logToStream('[SmartRun] Falha ao salvar no historico do BD: ' + String(dbErr));
      }

      const finalResultData = { ...resultJsonData, reportId };

      await logToStream('[SmartRun] Teste concluido!');
      await writer.write(encoder.encode(JSON.stringify({ type: 'result', data: finalResultData }) + '\n'));

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
