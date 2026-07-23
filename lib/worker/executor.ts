// -------------------------------------------------------
// Executor do Playwright — roda dentro do Worker BullMQ
// -------------------------------------------------------

import { chromium, type Page } from '@playwright/test';

import type { Job } from 'bullmq';
import type { AutomationJobData, AutomationJobResult, StepResult } from '../queue/types';
import { buildReportHtml } from './report-generator';
import * as fs from 'fs';
import * as path from 'path';

// Axe Builder — importado dinamicamente para evitar problemas no Next.js
async function runAxeAudit(page: Page): Promise<any[]> {
  try {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const result = await (new AxeBuilder({ page } as any))
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    return result.violations;
  } catch (e) {
    console.warn('[Executor] Axe audit failed (optional):', e);
    return [];
  }
}

async function autoAcceptCookies(page: Page) {
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
        break;
      }
    }
  } catch { /* ignore */ }
}

async function executeStep(
  page: Page,
  step: AutomationJobData['scriptSteps'][0],
  index: number,
  targetUrl: string,
  job: Job<AutomationJobData>
): Promise<StepResult> {
  const startTime = Date.now();
  let screenshotBase64: string | undefined;

  const takeScreenshot = async (): Promise<string | undefined> => {
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 70, timeout: 5000 });
      return buf.toString('base64');
    } catch { return undefined; }
  };

  let locator: any;
  try {
    if (step.action === 'goto') {
      await job.log(`[Passo #${index}] Ação: GOTO -> ${step.value || targetUrl}`);
      await page.goto(step.value || targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await autoAcceptCookies(page);
      await page.waitForTimeout(1000);
      screenshotBase64 = await takeScreenshot();
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: `Navegou para: ${step.value || targetUrl}`,
        screenshotBase64, duration: Date.now() - startTime,
      };
    }

    if (step.action === 'wait') {
      await job.log(`[Passo #${index}] Ação: WAIT -> ${step.milliseconds || 1000}ms`);
      await page.waitForTimeout(step.milliseconds || 1000);
      screenshotBase64 = await takeScreenshot();
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: `Aguardou ${step.milliseconds || 1000}ms`, screenshotBase64, duration: Date.now() - startTime,
      };
    }

    if (step.action === 'scroll') {
      await job.log(`[Passo #${index}] Ação: SCROLL`);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
      await page.waitForTimeout(800);
      screenshotBase64 = await takeScreenshot();
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: 'Rolagem da página executada.', screenshotBase64, duration: Date.now() - startTime,
      };
    }

    // Construir locator
    switch (step.selectorType) {
      case 'role':
        locator = page.getByRole(step.selector as any, step.value ? { name: step.value } : {});
        break;
      case 'text':
        locator = page.getByText(step.value || step.selector || '', { exact: false });
        break;
      case 'testid':
        locator = page.getByTestId(step.selector || '');
        break;
      case 'id':
        locator = page.locator(`#${step.selector}`);
        break;
      case 'xpath':
        locator = page.locator(`xpath=${step.selector}`);
        break;
      default: // 'css'
        locator = page.locator(step.selector || '*');
    }

    await job.log(`[Passo #${index}] Localizando: tipo='${step.selectorType}', seletor='${step.selector}', valor='${step.value}'`);

    // Tentar aceitar cookies caso haja banner bloqueando a tela
    await autoAcceptCookies(page);

    // Scroll para o elemento
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

    // Highlight visual temporário
    const originalStyle = await locator.evaluate((el: HTMLElement) => {
      const old = { shadow: el.style.boxShadow, outline: el.style.outline, border: el.style.border, transition: el.style.transition };
      el.style.transition = 'none';
      el.style.setProperty('box-shadow', '0 0 0 4px red, 0 0 16px rgba(255,0,0,0.7)', 'important');
      el.style.setProperty('outline', '3px solid red', 'important');
      el.style.setProperty('outline-offset', '3px', 'important');
      return old;
    }).catch(() => null);

    await page.waitForTimeout(400);

    // Remover highlight
    if (originalStyle) {
      await locator.evaluate((el: HTMLElement, old: any) => {
        el.style.transition = old.transition || '';
        el.style.boxShadow = old.shadow || '';
        el.style.outline = old.outline || '';
      }, originalStyle).catch(() => {});
    }

    await job.log(`[Passo #${index}] Executando ação: ${step.action}`);

    // Executar ação
    if (step.action === 'type') {
      await locator.fill(step.value || '', { timeout: 8000 });
      await page.waitForTimeout(500);
    } else if (step.action === 'select') {
      await locator.selectOption(step.value || '', { timeout: 8000 });
      await page.waitForTimeout(500);
    } else if (step.action === 'check') {
      await locator.check({ timeout: 8000 });
      await page.waitForTimeout(400);
    } else if (step.action === 'hover') {
      await locator.hover({ timeout: 8000 });
      await page.waitForTimeout(600);
    } else {
      // click (padrão)
      if (step.isPopup) {
        const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
        await locator.click({ timeout: 5000 });
        await popupPromise;
      } else {
        await locator.click({ timeout: 5000 });
      }
      // Aguardar a página reagir
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(1500),
      ]);
    }

    // Screenshot APÓS a ação — captura o estado resultante
    screenshotBase64 = await takeScreenshot();

    const detalhe = step.action === 'type'
      ? `Digitado: "${step.value}" no campo.`
      : step.action === 'hover'
      ? 'Hover realizado com sucesso.'
      : `Ação executada. URL atual: ${page.url()}`;

    // Retornar à URL inicial após registrar o teste do passo
    try {
      if (step.action !== 'goto') {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await autoAcceptCookies(page);
        await page.waitForTimeout(400);
      }
    } catch { /* ignore reset error */ }

    return {
      index, label: step.label, status: 'aprovado',
      detalhe, screenshotBase64, duration: Date.now() - startTime,
    };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    await job.log(`[Passo #${index}] ❌ FALHA: ${msg.substring(0, 200)}`);
    screenshotBase64 = await takeScreenshot().catch(() => undefined);

    // Retornar à URL base após erro
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    } catch { /* ignore */ }

    return {
      index, label: step.label, status: 'falha_clique',
      detalhe: `Falha na execução: ${msg.substring(0, 200)}`,
      screenshotBase64, duration: Date.now() - startTime,
    };
  }
}


export async function executeAutomation(
  job: Job<AutomationJobData>
): Promise<AutomationJobResult> {
  const { targetUrl, scriptSteps, jobId, jobName } = job.data;
  const results: StepResult[] = [];
  let axeViolations: any[] = [];

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
    ],
  });

  try {
    const context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // Bloquear print dialog
    await page.addInitScript(() => {
      window.print = () => console.log('[blocked] print dialog');
    });

    // Navegar para a URL alvo
    await job.log(`[Executor] Iniciando navegador e acessando URL base: ${targetUrl}`);
    await job.updateProgress(8);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Auditoria eMAG (Axe) — opcional
    await job.log(`[Executor] Analisando acessibilidade da página inicial...`);
    await job.updateProgress(14);
    axeViolations = await runAxeAudit(page);
    await job.log(`[Executor] ♿ Axe: ${axeViolations.length} violações de acessibilidade/WCAG encontradas.`);
    console.log(`[Executor] ♿ Axe: ${axeViolations.length} violações encontradas`);

    // Executar passos
    const totalSteps = scriptSteps.length;
    for (let i = 0; i < totalSteps; i++) {
      const step = scriptSteps[i];
      const progress = 14 + Math.floor(((i + 1) / totalSteps) * 72);
      await job.updateProgress(progress);

      const msg = `[Executor] Passo ${i + 1}/${totalSteps}: ${step.label}`;
      await job.log(msg);
      console.log(msg);
      const result = await executeStep(page, step, i + 1, targetUrl, job);
      results.push(result);
    }

    // Gerar Relatório HTML → PDF
    await job.log(`[Executor] Todos os passos concluídos. Gerando relatório...`);
    await job.updateProgress(90);
    const htmlContent = buildReportHtml({ results, axeViolations, targetUrl, jobName });

    const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const htmlFilename = `report-${jobId}.html`;
    const htmlPath = path.join(reportsDir, htmlFilename);
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    let pdfUrl: string | undefined;

    await context.close();

    const approved = results.filter(r => r.status === 'aprovado').length;
    const failed   = results.filter(r => r.status !== 'aprovado' && r.status !== 'pulado').length;

    await job.log(`[Executor] ✅ Finalizado com ${approved} aprovados e ${failed} falhas.`);

    return {
      status: 'completed',
      progress: 100,
      pdfUrl,
      htmlReportUrl: `/reports/${htmlFilename}`,
      steps: results,
      axeViolationsCount: axeViolations.length,
      totalSteps: results.length,
      approvedSteps: approved,
      failedSteps: failed,
      reportMarkdown: buildMarkdownSummary(results, axeViolations, targetUrl, jobName),
      completedAt: new Date().toISOString(),
    };

  } finally {
    await browser.close();
  }
}

function buildMarkdownSummary(results: StepResult[], violations: any[], url: string, name: string): string {
  const ok   = results.filter(r => r.status === 'aprovado').length;
  const fail = results.length - ok;
  return [
    `# Relatório de Execução — ${name}`,
    ``,
    `**URL Testada:** ${url}`,
    `**Status Final:** ${fail === 0 ? '✅ APROVADO' : '⚠️ ATENÇÃO — Há falhas'}`,
    ``,
    `## Métricas`,
    `| Item | Valor |`,
    `|------|-------|`,
    `| Total de Passos | ${results.length} |`,
    `| Aprovados | ${ok} |`,
    `| Falhas | ${fail} |`,
    `| Violações eMAG | ${violations.length} |`,
    ``,
    `## Detalhamento`,
    ...results.map(r => `- **#${r.index}** ${r.label}: \`${r.status}\` — ${r.detalhe}`),
  ].join('\n');
}
