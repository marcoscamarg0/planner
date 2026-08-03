import { NextResponse } from 'next/server';
import { gzipSync } from 'zlib';

export const runtime = 'nodejs';

function createTar(files: { name: string; content: string | Buffer }[]): Buffer {
  const buffers: Buffer[] = [];
  for (const file of files) {
    const contentBuf = typeof file.content === 'string' ? Buffer.from(file.content, 'utf8') : file.content;
    const header = Buffer.alloc(512);
    
    // Name (100 bytes)
    header.write(file.name.slice(0, 100), 0);
    // Mode (8 bytes)
    header.write('0000664\0', 100);
    // Uid (8 bytes)
    header.write('0000764\0', 108);
    // Gid (8 bytes)
    header.write('0000764\0', 116);
    // Size (12 bytes) (octal)
    const sizeOctal = contentBuf.length.toString(8).padStart(11, '0') + ' ';
    header.write(sizeOctal, 124);
    // Mtime (12 bytes)
    const mtimeOctal = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + ' ';
    header.write(mtimeOctal, 136);
    // Checksum (8 bytes) - initially spaces
    header.write('        ', 148);
    // Typeflag (1 byte)
    header.write('0', 156);
    // Magic (6 bytes)
    header.write('ustar ', 257);
    // Version (2 bytes)
    header.write(' \0', 263);

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    const checkOctal = checksum.toString(8).padStart(6, '0') + '\0 ';
    header.write(checkOctal, 148);

    buffers.push(header);
    buffers.push(contentBuf);
    
    // Padding to 512 bytes
    const padding = 512 - (contentBuf.length % 512);
    if (padding !== 512) {
      buffers.push(Buffer.alloc(padding));
    }
  }
  
  // End with two empty 512-byte blocks
  buffers.push(Buffer.alloc(1024));
  
  const tarBuf = Buffer.concat(buffers);
  return gzipSync(tarBuf);
}

function generatePlaywrightTest(targetUrl: string, steps: any[]): string {
  let code = `import { test, expect } from '@playwright/test';\n\n`;
  code += `test('Automação exportada', async ({ page }) => {\n`;
  code += `  await test.step('Navegar para ${targetUrl}', async () => {\n`;
  code += `    await page.goto('${targetUrl}');\n`;
  code += `  });\n\n`;

  if (steps && Array.isArray(steps)) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.action === 'goto' && (step.value === targetUrl || !step.value)) continue;

      code += `  await test.step('${step.label.replace(/'/g, "\\'")}', async () => {\n`;

      if (step.action === 'wait') {
        code += `    await page.waitForTimeout(${step.milliseconds || 1500});\n`;
      } else if (step.action === 'goto') {
        code += `    await page.goto('${step.value}');\n`;
      } else if (step.action === 'scroll') {
        code += `    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));\n`;
      } else if (step.action === 'closePopups') {
        code += `    const pages = page.context().pages();\n`;
        code += `    for (let j = pages.length - 1; j > 0; j--) { await pages[j].close(); }\n`;
        code += `    await page.bringToFront();\n`;
      } else {
        // Needs a locator
        let locatorStr = '';
        if (step.selectorType === 'role') {
          locatorStr = `page.getByRole('${step.selector}'${step.value ? `, { name: '${step.value}' }` : ''})`;
        } else if (step.selectorType === 'text') {
          locatorStr = `page.getByText('${step.value || step.selector}', { exact: false })`;
        } else if (step.selectorType === 'id') {
          locatorStr = `page.locator('#${step.selector}')`;
        } else {
          locatorStr = `page.locator('${step.selector}')`;
        }

        if (step.action === 'type') {
          code += `    await ${locatorStr}.first().fill('${step.value || ''}');\n`;
        } else if (step.action === 'select') {
          code += `    await ${locatorStr}.first().selectOption('${step.value || ''}');\n`;
        } else if (step.action === 'check') {
          code += `    await ${locatorStr}.first().check();\n`;
        } else if (step.action === 'hover') {
          code += `    await ${locatorStr}.first().hover();\n`;
        } else {
          // click
          if (step.isPopup) {
            code += `    const popupPromise = page.waitForEvent('popup');\n`;
            code += `    await ${locatorStr}.first().click();\n`;
            code += `    const popup = await popupPromise;\n`;
            code += `    await popup.waitForLoadState();\n`;
          } else {
            code += `    await ${locatorStr}.first().click();\n`;
          }
        }
      }
      code += `  });\n\n`;
    }
  }
  
  code += `});\n`;
  return code;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetUrl, rawSteps, jobName } = body;

    if (!targetUrl) {
      return NextResponse.json({ error: 'targetUrl é obrigatório' }, { status: 400 });
    }

    const packageJson = {
      name: "automacao-qa",
      version: "1.0.0",
      description: jobName || "Automação exportada do Planner QA",
      scripts: {
        "test": "playwright test",
        "test:ui": "playwright test --ui",
        "test:headed": "playwright test --headed"
      },
      devDependencies: {
        "@playwright/test": "^1.42.0",
        "@types/node": "^20.0.0"
      }
    };

    const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
`;

    const testCode = generatePlaywrightTest(targetUrl, rawSteps || []);

    const files = [
      { name: 'package.json', content: JSON.stringify(packageJson, null, 2) },
      { name: 'playwright.config.ts', content: playwrightConfig },
      { name: 'tests/automation.spec.ts', content: testCode },
      { name: 'README.md', content: '# Automação Exportada\\n\\n1. Execute `npm install`\\n2. Execute `npm run test`\\n' }
    ];

    const tarGzBuffer = createTar(files);

    return new NextResponse(tarGzBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="automacao.tar.gz"'
      }
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
