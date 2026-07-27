import { NextResponse } from "next/server";
import { chromium } from "@playwright/test";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let browser;
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL é obrigatória" }, { status: 400 });
    }

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Small wait for any lazy-loaded content
    await page.waitForTimeout(1500);

    const screenshots: { label: string; base64: string }[] = [];

    // ── 1. Full-page section captures (top / middle / bottom) ──────────────
    const pageHeight: number = await page.evaluate(() => document.body.scrollHeight);
    const viewportH = 800;

    const sections: { label: string; scrollY: number }[] = [
      { label: "Topo da Página", scrollY: 0 },
    ];
    if (pageHeight > viewportH * 1.5) {
      sections.push({ label: "Seção Intermediária", scrollY: Math.floor(pageHeight / 2 - viewportH / 2) });
    }
    if (pageHeight > viewportH * 2) {
      sections.push({ label: "Rodapé da Página", scrollY: Math.max(0, pageHeight - viewportH) });
    }

    for (const sec of sections) {
      try {
        await page.evaluate((y) => window.scrollTo(0, y), sec.scrollY);
        await page.waitForTimeout(400);
        const buf = await page.screenshot({ type: "jpeg", quality: 65 });
        screenshots.push({
          label: sec.label,
          base64: `data:image/jpeg;base64,${buf.toString("base64")}`,
        });
      } catch {
        // skip section
      }
    }

    // Scroll back to top before element captures
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // ── 2. Unique interactive element screenshots (deduplicated by position) ─
    // Track already-captured bounding boxes to avoid duplicates
    const capturedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const seenLabels = new Set<string>();
    let elementCount = 0;

    const isTooSimilar = (box: { x: number; y: number; w: number; h: number }) => {
      for (const cb of capturedBoxes) {
        const overlapX = Math.max(0, Math.min(box.x + box.w, cb.x + cb.w) - Math.max(box.x, cb.x));
        const overlapY = Math.max(0, Math.min(box.y + box.h, cb.y + cb.h) - Math.max(box.y, cb.y));
        const overlapArea = overlapX * overlapY;
        const boxArea = box.w * box.h;
        if (boxArea > 0 && overlapArea / boxArea > 0.6) return true; // >60% overlap = duplicate
      }
      return false;
    };

    // Priority element selectors — from most specific to most generic
    const prioritySelectors = [
      { sel: "nav a, header a", labelPrefix: "Navegação" },
      { sel: "button:not([disabled])", labelPrefix: "Botão" },
      { sel: "input[type='submit'], input[type='button']", labelPrefix: "Submit" },
      { sel: "a[href]:not([href='#'])", labelPrefix: "Link" },
      { sel: "form", labelPrefix: "Formulário" },
    ];

    for (const { sel, labelPrefix } of prioritySelectors) {
      if (elementCount >= 5) break;
      try {
        const locators = page.locator(sel);
        const total = await locators.count();
        for (let i = 0; i < total && elementCount < 5; i++) {
          const loc = locators.nth(i);
          try {
            if (!(await loc.isVisible())) continue;

            const box = await loc.boundingBox();
            if (!box || box.width < 8 || box.height < 8) continue;
            if (isTooSimilar({ x: box.x, y: box.y, w: box.width, h: box.height })) continue;

            const rawText = (await loc.innerText().catch(() => ""))
              || (await loc.getAttribute("aria-label").catch(() => ""))
              || (await loc.getAttribute("value").catch(() => ""))
              || (await loc.getAttribute("placeholder").catch(() => ""));
            const text = (rawText || "").trim().slice(0, 40);
            if (!text || text.length < 2) continue;

            const label = `${labelPrefix}: ${text}`;
            if (seenLabels.has(label.toLowerCase())) continue;

            // Scroll element into view
            await loc.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(200);

            const buf = await loc.screenshot({ type: "jpeg", quality: 72 }).catch(() => null);
            if (!buf) continue;

            screenshots.push({
              label,
              base64: `data:image/jpeg;base64,${buf.toString("base64")}`,
            });
            capturedBoxes.push({ x: box.x, y: box.y, w: box.width, h: box.height });
            seenLabels.add(label.toLowerCase());
            elementCount++;
          } catch {
            // skip element
          }
        }
      } catch {
        // skip selector
      }
    }

    return NextResponse.json({ screenshots });
  } catch (error: any) {
    console.error("Screenshot capture error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao carregar site e capturar imagens" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

