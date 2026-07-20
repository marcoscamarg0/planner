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
    
    // Set a common desktop viewport size
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Go to URL and wait until DOM is loaded
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    
    const screenshots: { label: string; base64: string }[] = [];

    // 1. Capture main page screenshot
    try {
      const mainScreenshot = await page.screenshot({ type: "jpeg", quality: 60 });
      screenshots.push({
        label: "Visão Geral da Página",
        base64: `data:image/jpeg;base64,${mainScreenshot.toString("base64")}`
      });
    } catch (err) {
      console.warn("Main screenshot failed:", err);
    }

    // 2. Identify top interactive elements and take cropped screenshots of them
    const elementSelectors = [
      "button:not([disabled])",
      "a.btn",
      "a:has-text('Entrar')",
      "a:has-text('Iniciar')",
      ".br-sign-in",
      "a:has-text('Acessibilidade')",
      "input[type='submit']",
      "input[type='button']"
    ];

    let count = 0;
    for (const selector of elementSelectors) {
      if (count >= 5) break;
      try {
        const locator = page.locator(selector).first();
        if (await locator.isVisible()) {
          const buffer = await locator.screenshot({ type: "jpeg", quality: 70 });
          const text = await locator.innerText() || await locator.getAttribute("aria-label") || await locator.getAttribute("placeholder") || selector;
          
          if (text && text.trim().length > 1) {
            screenshots.push({
              label: text.trim().slice(0, 30),
              base64: `data:image/jpeg;base64,${buffer.toString("base64")}`
            });
            count++;
          }
        }
      } catch {
        // Skip and try next selector
      }
    }

    // Fallback: If not enough elements captured, grab first few button/links
    if (count < 3) {
      try {
        const buttons = page.locator("button, a");
        const btnCount = await buttons.count();
        for (let i = 0; i < btnCount && count < 6; i++) {
          const loc = buttons.nth(i);
          if (await loc.isVisible()) {
            const text = await loc.innerText();
            if (text && text.trim().length > 1 && text.trim().length < 30) {
              const buffer = await loc.screenshot({ type: "jpeg", quality: 70 });
              screenshots.push({
                label: text.trim(),
                base64: `data:image/jpeg;base64,${buffer.toString("base64")}`
              });
              count++;
            }
          }
        }
      } catch (err) {
        console.warn("Fallback button locator failed:", err);
      }
    }

    return NextResponse.json({ screenshots });
  } catch (error: any) {
    console.error("Screenshot capture error:", error);
    return NextResponse.json({ error: error.message || "Falha ao carregar site e capturar imagens" }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
