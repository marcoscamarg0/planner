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
  job: Job<AutomationJobData>,
  lastScreenshotHash: { value: string | undefined }
): Promise<StepResult> {
  const startTime = Date.now();
  let screenshotBase64: string | undefined;
  let screenshotElementBase64: string | undefined;

  // Simple hash (length + first 64 chars of base64) to detect duplicates
  const hashOf = (b64: string) => `${b64.length}:${b64.substring(0, 64)}`;

  const takeScreenshot = async (force = false): Promise<string | undefined> => {
    try {
      const pages = page.context().pages();
      const activePage = pages[pages.length - 1]; // Most recent tab
      
      await activePage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await activePage.waitForTimeout(1500); // Reduced from 2500ms
      
      const buf = await activePage.screenshot({ type: 'jpeg', quality: 70, timeout: 8000 });
      const b64 = buf.toString('base64');

      // Close extra tabs opened via target="_blank"
      if (pages.length > 1) {
        for (let i = 1; i < pages.length; i++) {
          await pages[i].close().catch(() => {});
        }
      }

      // Deduplicate: skip if the page looks identical to the previous screenshot
      const currentHash = hashOf(b64);
      if (!force && lastScreenshotHash.value && currentHash === lastScreenshotHash.value) {
        return undefined; // Same screen — don't repeat
      }

      lastScreenshotHash.value = currentHash;
      return b64;
    } catch { return undefined; }
  };

  let locator: any;
  try {
    if (step.action === 'goto') {
      await job.log(`[Passo #${index}] Ação: GOTO -> ${step.value || targetUrl}`);
      await page.goto(step.value || targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await autoAcceptCookies(page);
      await page.waitForTimeout(800);
      // Always take a screenshot on goto (new page — force=true to bypass dedup)
      screenshotBase64 = await takeScreenshot(true);
      
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: `Navegou para: ${step.value || targetUrl}`,
        screenshotBase64, duration: Date.now() - startTime,
      };
    }

    if (step.action === 'wait') {
      await job.log(`[Passo #${index}] Ação: WAIT -> ${step.milliseconds || 1000}ms`);
      await page.waitForTimeout(step.milliseconds || 1000);
      // Waits: take screenshot but deduplicate (may be same page)
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
      // Scroll: take screenshot — new content should be visible
      screenshotBase64 = await takeScreenshot();
      
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: 'Rolagem da página executada.', screenshotBase64, duration: Date.now() - startTime,
      };
    }

    // Build locator
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

    locator = locator.first();

    await job.log(`[Passo #${index}] Localizando: tipo='${step.selectorType}', seletor='${step.selector}', valor='${step.value}'`);

    await autoAcceptCookies(page);
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

    // Temporary visual highlight
    const originalStyle = await locator.evaluate((el: HTMLElement) => {
      const old = { shadow: el.style.boxShadow, outline: el.style.outline, border: el.style.border, transition: el.style.transition };
      el.style.transition = 'none';
      el.style.setProperty('box-shadow', '0 0 0 4px red, 0 0 16px rgba(255,0,0,0.7)', 'important');
      el.style.setProperty('outline', '3px solid red', 'important');
      el.style.setProperty('outline-offset', '3px', 'important');
      return old;
    }).catch(() => null);

    await page.waitForTimeout(400);

    // Element close-up screenshot (before action)
    if (step.action === 'click' || !step.action) {
      const buf = await locator.screenshot({ type: 'jpeg', quality: 80, timeout: 5000 }).catch(() => null);
      if (buf) screenshotElementBase64 = buf.toString('base64');
    }

    // Remove highlight
    if (originalStyle) {
      await locator.evaluate((el: HTMLElement, old: any) => {
        el.style.transition = old.transition || '';
        el.style.boxShadow = old.shadow || '';
        el.style.outline = old.outline || '';
      }, originalStyle).catch(() => {});
    }

    await job.log(`[Passo #${index}] Executando ação: ${step.action}`);

    // Execute action
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
      // click (default)
      if (step.isPopup) {
        const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
        await locator.click({ force: true, timeout: 5000 });
        await popupPromise;
      } else {
        await locator.click({ force: true, timeout: 5000 });
      }
      // Wait for page to react
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(1500),
      ]);
    }

    // Full-page screenshot after every action — deduplicated
    screenshotBase64 = await takeScreenshot();

    const activeUrl = page.context().pages().slice(-1)[0].url();
    let detalhe = step.action === 'type'
      ? `Digitado: "${step.value}" no campo.`
      : step.action === 'hover'
      ? 'Hover realizado com sucesso.'
      : `Ação executada.`;
      
    if (activeUrl !== targetUrl && activeUrl !== 'about:blank') {
      detalhe += ` ➡️ Nova página: ${activeUrl}`;
    }

    return {
      index, label: step.label, status: 'aprovado',
      detalhe, screenshotBase64, screenshotElementBase64, duration: Date.now() - startTime,
    };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    await job.log(`[Passo #${index}] ❌ FALHA: ${msg.substring(0, 200)}`);
    screenshotBase64 = await takeScreenshot(true).catch(() => undefined);

    // Return to base URL after error
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    } catch { /* ignore */ }

    return {
      index, label: step.label, status: 'falha_clique',
      detalhe: `Falha na execução: ${msg.substring(0, 200)}`,
      screenshotBase64, screenshotElementBase64, duration: Date.now() - startTime,
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

    // Execute steps
    const totalSteps = scriptSteps.length;
    const lastScreenshotHash: { value: string | undefined } = { value: undefined };
    for (let i = 0; i < totalSteps; i++) {
      const step = scriptSteps[i];
      const progress = 14 + Math.floor(((i + 1) / totalSteps) * 72);
      await job.updateProgress(progress);

      const msg = `[Executor] Passo ${i + 1}/${totalSteps}: ${step.label}`;
      await job.log(msg);
      console.log(msg);
      const result = await executeStep(page, step, i + 1, targetUrl, job, lastScreenshotHash);
      results.push(result);
    }

    // Gerar Relatório HTML → PDF
    await job.log(`[Executor] Todos os passos concluídos. Gerando relatório...`);
    await job.updateProgress(90);
    const htmlContent = buildReportHtml({ results, axeViolations, targetUrl, jobName });

    const { createAppwriteClient } = require('../appwrite/adapter');
    const supabase = createAppwriteClient();

    const htmlFilename = `report-${jobId}.html`;
    let htmlReportUrl = '';

    try {
      const { data, error: htmlErr } = await supabase.storage.from('reports').upload(htmlFilename, htmlContent, { contentType: 'text/html', upsert: true });
      if (htmlErr) throw htmlErr;
      htmlReportUrl = supabase.storage.from('reports').getPublicUrl(htmlFilename).data.publicUrl;
      await job.log('[Executor] Relatório HTML salvo na nuvem.');
    } catch (err) {
      await job.log('[Executor] Falha no upload HTML, salvando local: ' + String(err));
      const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
      const htmlPath = path.join(reportsDir, htmlFilename);
      fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
      htmlReportUrl = `/reports/${htmlFilename}`;
    }

    let pdfUrl: string | undefined;

    try {
      await job.log('[Executor] Gerando e fazendo upload do PDF...');
      const pdfBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      const pdfPage = await pdfBrowser.newPage();
      await pdfPage.setContent(htmlContent, { waitUntil: 'networkidle', timeout: 30000 });
      const pdfFilename = `report-${jobId}.pdf`;
      const pdfBuffer = await pdfPage.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
      await pdfBrowser.close();

      const { error: pdfErr } = await supabase.storage.from('reports').upload(pdfFilename, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (pdfErr) throw pdfErr;

      pdfUrl = supabase.storage.from('reports').getPublicUrl(pdfFilename).data.publicUrl;
      await job.log('[Executor] PDF salvo com sucesso no Supabase Storage.');
    } catch (pdfErr) {
      await job.log('[Executor] Erro ao gerar/upload PDF: ' + String(pdfErr));
    }

    await context.close();

    const approved = results.filter(r => r.status === 'aprovado').length;
    const failed   = results.filter(r => r.status !== 'aprovado' && r.status !== 'pulado').length;

    await job.log(`[Executor] ✅ Finalizado com ${approved} aprovados e ${failed} falhas.`);

    return {
      status: 'completed',
      progress: 100,
      pdfUrl,
      htmlReportUrl,
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
