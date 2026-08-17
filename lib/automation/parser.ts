import { AutomationStep, AutomationAction, SelectorType } from '../queue/types';

/** Walk through a string tracking escape sequences so we know if we're inside a JSON string literal */
export function balancedSlice(src: string, start: number, open: string, close: string): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null; // not closed (truncated)
}

export function robustJsonParse(raw: string): any {
  // Strategy 1: remove trailing commas then parse directly
  let cleaned = raw.replace(/,\s*([\}\]])/g, '$1');
  try { return JSON.parse(cleaned); } catch { /* next */ }

  // Strategy 2: strip JS-style comments, then parse
  cleaned = cleaned
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  try { return JSON.parse(cleaned); } catch { /* next */ }

  // Strategy 3: find "steps" array using string-aware bracket balancing.
  const stepsIdx = cleaned.indexOf('"steps"');
  if (stepsIdx !== -1) {
    const arrayStart = cleaned.indexOf('[', stepsIdx);
    if (arrayStart !== -1) {
      const fullArray = balancedSlice(cleaned, arrayStart, '[', ']');
      let arrayStr: string;

      if (fullArray) {
        arrayStr = fullArray;
      } else {
        // Truncated — walk from arrayStart collecting complete objects
        const partial = cleaned.slice(arrayStart + 1);
        let collected = '[';
        let pos = 0;
        while (pos < partial.length) {
          const objStart = partial.indexOf('{', pos);
          if (objStart === -1) break;
          const obj = balancedSlice(partial, objStart, '{', '}');
          if (!obj) break; // this object is also truncated — stop here
          if (collected.length > 1) collected += ',';
          collected += obj;
          pos = objStart + obj.length;
        }
        arrayStr = collected + ']';
      }

      arrayStr = arrayStr.replace(/,\s*([\}\]])/g, '$1');
      try {
        const steps = JSON.parse(arrayStr);
        if (Array.isArray(steps) && steps.length > 0) {
          console.log('[AutomationParser] robustJsonParse estratégia 3: ' + steps.length + ' passos extraídos.');
          return { steps };
        }
      } catch { /* next */ }
    }
  }

  // Strategy 4: string-aware bracket-balanced extraction of every {…} object
  const steps: any[] = [];
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] !== '{') { i++; continue; }
    const obj = balancedSlice(cleaned, i, '{', '}');
    if (obj) {
      try {
        const parsed = JSON.parse(obj.replace(/,\s*([\}\]])/g, '$1'));
        if (typeof parsed.action === 'string') steps.push(parsed);
      } catch { /* malformed object, skip */ }
      i += obj.length;
    } else {
      i++; // truncated object — skip
    }
  }
  if (steps.length > 0) {
    console.log('[AutomationParser] robustJsonParse estratégia 4: ' + steps.length + ' passos extraídos individualmente.');
    return { steps };
  }

  throw new SyntaxError('robustJsonParse: nenhuma estratégia conseguiu extrair os passos.');
}

// -------------------------------------------------------
// Detect if input is already a JSON steps array/object or Playwright code
// Returns parsed steps or null if not detectable
// -------------------------------------------------------
export function tryParseDirectSteps(input: string, targetUrl?: string): AutomationStep[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // --- 1. JSON Array / Steps Object Detection ---
  if (trimmed.startsWith('[') || (trimmed.startsWith('{') && (trimmed.includes('"action"') || trimmed.includes('"steps"')))) {
    const candidates = [trimmed];
    if (trimmed.startsWith('[')) {
      candidates.push('{"steps":' + trimmed + '}');
    }
    for (const candidate of candidates) {
      try {
        const parsed = robustJsonParse(candidate);
        if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          const valid = parsed.steps.filter((s: any) => typeof s.action === 'string');
          if (valid.length > 0) {
            console.log('[AutomationParser] Passos JSON detectados diretamente no input: ' + valid.length);
            return valid as AutomationStep[];
          }
        }
      } catch { /* next */ }
    }
  }

  // --- 2. NATIVE PARSING: Playwright Codegen JSONL ---
  if (trimmed.includes('"name":"') && (trimmed.includes('"openPage"') || trimmed.includes('"navigate"') || trimmed.includes('"click"'))) {
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.startsWith('{') && l.endsWith('}'));
    if (lines.length > 0) {
      const pwSteps: AutomationStep[] = [];
      let stepCount = 0;
      let lastUrl = '';

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          
          if (obj.name === 'openPage' || obj.name === 'navigate') {
            if (obj.url && obj.url !== '' && obj.url !== 'about:blank' && obj.url !== 'chrome-error://chromewebdata/') {
               if (obj.url === lastUrl) continue;
               
               if (stepCount === 0) {
                 pwSteps.push({ action: 'goto', value: obj.url, label: `Acessar ${obj.url}` });
               } else {
                 pwSteps.push({ action: 'goto', value: obj.url, label: `Navegar para ${obj.url}` });
               }
               lastUrl = obj.url;
               stepCount++;
            }
          } else if (obj.name === 'click') {
            const sel = obj.selector || '';
            const isRole = sel.includes('internal:role=');
            const isText = sel.includes('internal:text=');
            let type: any = 'css';
            let val = sel;
            let label = 'Clicar no elemento';

            if (isRole) {
              type = 'role';
              const match = sel.match(/internal:role=([^\[]+)\[name=\"?([^\"]+?)\"?i?\]/);
              if (match) {
                val = match[2];
                type = match[1];
                label = `Clicar em ${type} ${val}`;
              }
            } else if (isText) {
              type = 'text';
              val = sel.replace('internal:text=', '').replace(/\"/g, '');
              label = `Clicar no texto "${val}"`;
            } else if (sel.includes('internal:attr=')) {
              type = 'css';
              val = sel.replace('internal:attr=', '').replace(/\[([^\]]+)\]i?/, '[$1]');
              label = `Clicar no elemento ${val}`;
            }

            const selectorType = isRole ? 'role' : type;
            const selectorRole = isRole ? type : val;
            pwSteps.push({ action: 'click', selectorType, selector: selectorRole, value: val, label });
            stepCount++;
          } else if (obj.name === 'fill') {
            pwSteps.push({ action: 'type', selectorType: 'css', selector: obj.selector, value: obj.text || '', label: `Preencher campo` });
            stepCount++;
          }
        } catch { /* ignore */ }
      }
      
      if (pwSteps.length > 0) {
        console.log('[AutomationParser] Parse nativo de Playwright Codegen: ' + pwSteps.length + ' passos gerados.');
        return pwSteps;
      }
    }
  }

  // --- 3. NATIVE PARSING: Playwright TypeScript / JavaScript Code ---
  // Detection must be strict — Portuguese text like "a página de consulta" contains "página" and could be false-positive.
  // Require actual code patterns: await keyword, function calls with (), or explicit Playwright imports.
  const isPlaywrightCode = 
    trimmed.includes('@playwright/test') ||
    trimmed.includes('getByPlaceholder(') ||
    trimmed.includes('getByRole(') ||
    trimmed.includes('getByText(') ||
    trimmed.includes('getByLabel(') ||
    trimmed.includes('getByTestId(') ||
    trimmed.includes('locator(') ||
    /\bawait\s+page\s*\./.test(trimmed) ||
    /\bpage\.(goto|click|fill|type|waitFor)\s*\(/.test(trimmed) ||
    (trimmed.includes('test(') && trimmed.includes('async')) ||
    trimmed.includes('test.describe(');

  if (isPlaywrightCode) {
    const pwSteps: AutomationStep[] = [];
    const locators: Record<string, string> = {};
    const lines = trimmed.split('\n').map(l => l.trim());
    
    for (const line of lines) {
      if (!line) continue;
      
      // goto
      let m = line.match(/(?:await\s+)?page\.goto\((['"`])(.*?)\1/);
      if (m) {
        pwSteps.push({ action: 'goto', value: m[2], label: `Acessar ${m[2]}` });
        continue;
      }

      // waitForLoadState / waitForTimeout / waitForURL / waitForSelector
      m = line.match(/(?:await\s+)?page\.(waitForLoadState|waitForTimeout|waitForURL|waitForSelector)\(/);
      if (m) {
        const ms = m[1] === 'waitForTimeout' ? 2000 : 1500;
        pwSteps.push({ action: 'wait', milliseconds: ms, label: 'Aguardar carregamento da página' });
        continue;
      }

      // locator assignment: const varName = page.locator('selector', ...)
      m = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*page\.locator\((['"`])(.*?)\2/);
      if (m) {
        locators[m[1]] = m[3];
        continue;
      }

      // locator assignment: getByPlaceholder
      m = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*page\.getByPlaceholder\((['"`])(.*?)\2/);
      if (m) {
        locators[m[1]] = `input[placeholder="${m[3]}" i], [placeholder*="${m[3]}" i]`;
        continue;
      }

      // locator assignment: getByLabel
      m = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*page\.getByLabel\((['"`])(.*?)\2/);
      if (m) {
        locators[m[1]] = `label:has-text("${m[3]}")`;
        continue;
      }

      // locator assignment: getByTestId
      m = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*page\.getByTestId\((['"`])(.*?)\2/);
      if (m) {
        locators[m[1]] = `[data-testid="${m[3]}"]`;
        continue;
      }

      // getByPlaceholder fill: await page.getByPlaceholder('X').fill('Y')
      m = line.match(/(?:await\s+)?page\.getByPlaceholder\((['"`])(.*?)\1\)\.fill\((['"`])(.*?)\3\)/);
      if (m) {
        const sel = m[2].toLowerCase().includes('email') || m[2].toLowerCase().includes('e-mail')
          ? `input[type="email"], input[placeholder*="${m[2]}" i], [placeholder*="${m[2]}" i]`
          : m[2].toLowerCase().includes('senha') || m[2].toLowerCase().includes('password')
          ? `input[type="password"], input[placeholder*="${m[2]}" i], [placeholder*="${m[2]}" i]`
          : `input[placeholder*="${m[2]}" i], [placeholder*="${m[2]}" i]`;
        pwSteps.push({ action: 'type', selectorType: 'css', selector: sel, value: m[4], label: `Preencher campo ${m[2]}` });
        continue;
      }

      // getByLabel fill: await page.getByLabel('X').fill('Y')
      m = line.match(/(?:await\s+)?page\.getByLabel\((['"`])(.*?)\1\)\.fill\((['"`])(.*?)\3\)/);
      if (m) {
        pwSteps.push({ action: 'type', selectorType: 'css', selector: `label:has-text("${m[2]}")`, value: m[4], label: `Preencher campo ${m[2]}` });
        continue;
      }

      // getByTestId click: await page.getByTestId('X').click()
      m = line.match(/(?:await\s+)?page\.getByTestId\((['"`])(.*?)\1\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: `[data-testid="${m[2]}"]`, value: `[data-testid="${m[2]}"]`, label: `Clicar em ${m[2]}` });
        continue;
      }

      // getByPlaceholder click: await page.getByPlaceholder('X').click()
      m = line.match(/(?:await\s+)?page\.getByPlaceholder\((['"`])(.*?)\1\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: `[placeholder="${m[2]}"]`, value: `[placeholder="${m[2]}"]`, label: `Clicar no campo ${m[2]}` });
        continue;
      }

      // getByRole click: await page.getByRole('button', { name: 'X' }).click()
      m = line.match(/(?:await\s+)?page\.getByRole\((['"`])([^'"`]+)\1\s*,\s*\{\s*name:\s*(['"`])([^'"`]+)\3\s*\}\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'role', selector: m[2], value: m[4], label: `Clicar em ${m[2]} ${m[4]}` });
        continue;
      }

      // getByRole fill: await page.getByRole('textbox', { name: 'X' }).fill('Y')
      m = line.match(/(?:await\s+)?page\.getByRole\((['"`])[^'"`]+\1\s*,\s*\{\s*name:\s*(['"`])(.*?)\2\s*\}\)\.fill\((['"`])(.*?)\4\)/);
      if (m) {
        pwSteps.push({ action: 'type', selectorType: 'css', selector: `[aria-label="${m[3]}"]`, value: m[5], label: `Preencher campo ${m[3]}` });
        continue;
      }

      // getByText click: await page.getByText('X').click()
      m = line.match(/(?:await\s+)?page\.getByText\((['"`])(.*?)\1\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'text', selector: m[2], value: m[2], label: `Clicar em "${m[2]}"` });
        continue;
      }

      // direct page.click('selector'): await page.click('button[data-testid="X"]')
      m = line.match(/(?:await\s+)?page\.click\((['"`])(.*?)\1\)/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: m[2], value: m[2], label: `Clicar no elemento ${m[2]}` });
        continue;
      }

      // direct page.fill('selector', 'value'): await page.fill('input', 'X')
      m = line.match(/(?:await\s+)?page\.fill\((['"`])(.*?)\1\s*,\s*(['"`])(.*?)\3\)/);
      if (m) {
        pwSteps.push({ action: 'type', selectorType: 'css', selector: m[2], value: m[4], label: `Preencher campo ${m[2]}` });
        continue;
      }

      // inline locator fill: await page.locator('...').fill(...)
      m = line.match(/(?:await\s+)?page\.locator\((['"`])(.*?)\1.*?\)\.fill\((['"`])(.*?)\3\)/);
      if (m) {
        pwSteps.push({ action: 'type', selectorType: 'css', selector: m[2], value: m[4], label: 'Preencher campo' });
        continue;
      }

      // inline locator click: await page.locator('...').click(...)
      m = line.match(/(?:await\s+)?page\.locator\((['"`])(.*?)\1.*?\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: m[2], value: m[2], label: 'Clicar no elemento' });
        continue;
      }

      // variable fill: await varName.fill(...)
      m = line.match(/(?:await\s+)?([a-zA-Z0-9_]+)\.fill\((['"`])(.*?)\2\)/);
      if (m && locators[m[1]]) {
        pwSteps.push({ action: 'type', selectorType: 'css', selector: locators[m[1]], value: m[3], label: 'Preencher campo' });
        continue;
      }

      // variable click: await varName.click(...)
      m = line.match(/(?:await\s+)?([a-zA-Z0-9_]+)\.click\(/);
      if (m && locators[m[1]]) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: locators[m[1]], value: locators[m[1]], label: 'Clicar no elemento' });
        continue;
      }

      // assertions / expect are checks on previous steps, not extra interaction steps
      if (line.includes('expect(')) {
        continue;
      }
    }
    
    if (pwSteps.length > 0) {
      if (pwSteps[0].action !== 'goto' && targetUrl) {
        pwSteps.unshift({ action: 'goto', value: targetUrl, label: 'Acessar ' + targetUrl });
      }
      console.log('[AutomationParser] Parse nativo de Playwright TS/JS: ' + pwSteps.length + ' passos gerados.');
      return pwSteps;
    }
  }

  // --- 4. DETERMINISTIC PORTUGUESE ROTEIRO PARSING ---
  // IMPORTANT: If the text looks like a structured QA plan (has **Passos:** or **Resultado Esperado:**),
  // skip the deterministic parser and let the AI handle it — the AI generates much richer automation
  // steps (URL verification, proper assertions, waits) than the simple parser can.
  const isStructuredQaPlan = /\*{0,2}Passos:?\*{0,2}/i.test(trimmed) || /\*{0,2}Resultado\s+Esperado:?\*{0,2}/i.test(trimmed);
  if (!isStructuredQaPlan) {
    const roteiro = parsePortugueseRoteiro(trimmed, targetUrl || 'https://ia.transportes.gov.br/');
    if (roteiro && roteiro.length > 0) {
      console.log('[AutomationParser] Parse nativo de Roteiro PT-BR: ' + roteiro.length + ' passos gerados.');
      return roteiro as unknown as AutomationStep[];
    }
  } else {
    console.log('[AutomationParser] Plano QA estruturado detectado — delegando para IA para geração completa de passos.');
  }

  return null;
}

// -------------------------------------------------------
// Deterministic parser: converts PT-BR roteiro steps (numbered,
// bulleted, or plain lines) into SmartStep[] without any AI call.
// -------------------------------------------------------
export interface ParsedSmartStep {
  action: AutomationAction;
  label: string;
  selectorType?: SelectorType;
  selector?: string;
  value?: string | null;
  milliseconds?: number;
}

/**
 * Extracts the quoted text from a step description.
 */
function extractQuoted(text: string): string | null {
  const m = text.match(/["'\u00ab\u201c\u201d]([^"'\u00bb\u201c\u201d]+)["'\u00bb\u201c\u201d]/);
  return m ? m[1].trim() : null;
}

/**
 * Tries to extract a URL from the step text.
 */
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[.,;:)]$/, '') : null;
}

/**
 * Parses a PT-BR QA roteiro into SmartStep[].
 */
export function parsePortugueseRoteiro(
  input: string,
  targetUrl: string
): ParsedSmartStep[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null;

  // --- PRIORITY: Extract only the **Passos:** section if it exists ---
  // This prevents "Plano de Ação" documentation phases from being treated as test steps.
  const passosMatch = trimmed.match(/\*{0,2}Passos:?\*{0,2}\s*\n([\s\S]*?)(?:\n\*{0,2}Resultado\s+Esperado|$)/i);
  let sourceText = trimmed;
  if (passosMatch) {
    sourceText = passosMatch[1].trim();
    console.log('[AutomationParser] Seção **Passos:** encontrada — usando apenas os passos do teste.');
  }

  // Extract all step lines (lines starting with numbers "1.", "1 -", "Passo 1:", bullets "- ", "* ", or meaningful action lines)
  const stepLines: string[] = [];
  const lines = sourceText.split('\n');

  for (const rawLine of lines) {
    const l = rawLine.trim();
    if (!l) continue;
    if (l.startsWith('**Categoria') || l.startsWith('**Prioridade') || l.startsWith('**Resultado') || l.startsWith('Categoria:') || l.startsWith('Prioridade:') || l.startsWith('**Passos:') || l.startsWith('Passos:')) {
      continue;
    }
    // Skip documentation-style headings like "## Fase 1:" or "**Plano de Ação**"
    if (/^#{1,3}\s/.test(l) || /^\*\*(?:Fase|Plano|Etapa|Passo\s+\d+\s*[-–:])/i.test(l)) {
      continue;
    }

    const numberedMatch = l.match(/^(?:(?:\d+[\.\)\-:]|\bpasso\s*\d+[\.\)\-:]|[-*•])\s*)(.+)/i);
    if (numberedMatch) {
      stepLines.push(numberedMatch[1].trim());
    } else if (/^(?:acessar|navegar|preencher|digitar|inserir|clicar|apertar|pressionar|aguardar|esperar|verificar|validar)\b/i.test(l)) {
      stepLines.push(l);

    }
  }

  if (stepLines.length === 0) return null;

  const steps: ParsedSmartStep[] = [];
  let hasInitialGoto = false;

  for (const raw of stepLines) {
    const lower = raw.toLowerCase();

    // 1. NAVIGATE / GOTO
    if (
      lower.startsWith('acessar') || lower.startsWith('navegar') ||
      lower.startsWith('ir para') || lower.startsWith('abrir') ||
      lower.startsWith('entrar em') || lower.startsWith('visitar') ||
      lower.startsWith('url')
    ) {
      const url = extractUrl(raw) || targetUrl;
      steps.push({ action: 'goto', label: raw, value: url });
      hasInitialGoto = true;
      continue;
    }

    // 2. SCROLL
    if (lower.includes('rolar') || lower.includes('scroll')) {
      steps.push({ action: 'scroll', label: raw });
      continue;
    }

    // 3. WAIT
    if (lower.startsWith('aguardar') || lower.startsWith('esperar') || lower.startsWith('wait')) {
      const msMatch = raw.match(/(\d+)\s*(ms|milissegundo|segundo)/i);
      const ms = msMatch
        ? parseInt(msMatch[1]) * (msMatch[2].toLowerCase().startsWith('s') ? 1000 : 1)
        : 2000;
      steps.push({ action: 'wait', label: raw, milliseconds: ms });
      continue;
    }

    // 4. VERIFY / ASSERTION (Redirecionamento, Dashboard, Visibilidade)
    if (
      lower.startsWith('verificar') || lower.startsWith('validar') ||
      lower.startsWith('checar') || lower.startsWith('conferir') ||
      lower.startsWith('garantir') || lower.startsWith('assert') || lower.startsWith('verify')
    ) {
      steps.push({ action: 'wait', label: raw, milliseconds: 2000 });
      continue;
    }

    // 5. HOVER
    if (lower.startsWith('passar o mouse') || lower.startsWith('hover')) {
      const quoted = extractQuoted(raw) || raw.replace(/^passar o mouse\s+(?:em|no|na|sobre)?\s*/i, '').trim();
      steps.push({ action: 'hover', label: raw, selectorType: 'text', selector: quoted, value: quoted });
      continue;
    }

    // 6. TYPE / FILL
    if (
      lower.startsWith('preencher') || lower.startsWith('digitar') ||
      lower.startsWith('inserir') || lower.startsWith('escrever') ||
      lower.startsWith('informar') || lower.startsWith('colocar') ||
      lower.startsWith('fill') || lower.startsWith('type')
    ) {
      // Try pattern with quotes: "campo" com "valor"
      const fieldMatch = raw.match(/["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]\s+(?:com|de|:|=)\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i);
      
      // Try pattern without quotes: Preencher o campo de e-mail com marcos.camargo@transportes.gov.br
      const unquotedMatch = raw.match(/^(?:preencher|digitar|inserir|escrever|informar|colocar|fill|type)\s+(?:o\s+|a\s+)?(?:campo\s+(?:de\s+|do\s+|da\s+)?)?(.+?)\s+(?:com|de|:|=)\s+(.+)$/i);

      let field = '';
      let val = '';

      if (fieldMatch) {
        field = fieldMatch[1].trim();
        val = fieldMatch[2].trim();
      } else if (unquotedMatch) {
        field = unquotedMatch[1].trim();
        val = unquotedMatch[2].trim();
      } else {
        const quoted = extractQuoted(raw);
        field = quoted || 'input';
        val = '';
      }

      const fLower = field.toLowerCase();
      let selector = '';

      if (fLower.includes('email') || fLower.includes('e-mail') || fLower.includes('usuário') || fLower.includes('usuario') || fLower.includes('login')) {
        selector = 'input[type="email"], #email, [placeholder*="email" i], input[name*="email" i], input[name*="usuario" i], input[name*="login" i], [placeholder*="usuário" i]';
      } else if (fLower.includes('senha') || fLower.includes('password') || fLower.includes('pass')) {
        selector = 'input[type="password"], #senha, [placeholder*="senha" i], input[name*="senha" i], input[name*="password" i], [placeholder*="password" i]';
      } else {
        selector = `input[placeholder*="${field}" i], input[name*="${field}" i], input[id*="${field}" i], #${field}, [aria-label*="${field}" i]`;
      }

      steps.push({
        action: 'type',
        label: raw,
        selectorType: 'css',
        selector,
        value: val,
      });
      continue;
    }

    // 7. CHECK / MARCAR
    if (lower.startsWith('marcar') || lower.startsWith('desmarcar') || lower.startsWith('check')) {
      const quoted = extractQuoted(raw) || raw.replace(/^marcar\s+(?:o|a|no|na)?\s*/i, '').trim();
      steps.push({ action: 'check', label: raw, selectorType: 'text', selector: quoted, value: quoted });
      continue;
    }

    // 8. SELECT / SELECIONAR
    if (lower.startsWith('selecionar') || lower.startsWith('escolher')) {
      const quoted = extractQuoted(raw) || raw.replace(/^selecionar\s+(?:o|a|no|na)?\s*/i, '').trim();
      steps.push({ action: 'select', label: raw, selectorType: 'text', selector: quoted, value: quoted });
      continue;
    }

    // 9. CLICK / SUBMETER (Default for actions)
    const isLoginButton = lower.includes('login') || lower.includes('submeter') || lower.includes('entrar') || lower.includes('acessar');
    const isSubmitButton = lower.includes('salvar') || lower.includes('confirmar') || lower.includes('enviar') || lower.includes('cadastrar');

    let clickSelector = '';
    let clickSelectorType: SelectorType = 'text';
    let clickVal = raw;

    if (isLoginButton) {
      clickSelector = 'button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar"), input[type="submit"]';
      clickSelectorType = 'css';
      clickVal = 'login';
    } else if (isSubmitButton) {
      clickSelector = 'button[type="submit"], button:has-text("Salvar"), button:has-text("Confirmar"), button:has-text("Enviar"), input[type="submit"]';
      clickSelectorType = 'css';
      clickVal = 'confirmar';
    } else {
      const quoted = extractQuoted(raw);
      if (quoted) {
        // Use text selector — much more robust than CSS :has-text()
        clickSelector = quoted;
        clickSelectorType = 'text';
        clickVal = quoted;
      } else {
        const hint = raw
          .replace(/^Clicar\s+(?:no|na|nos|nas|em|no\s+bot[aã]o(?:\s+de|\s+do|\s+da)?|no\s+link|no\s+card|no\s+menu|no\s+item)\s+/i, '')
          .replace(/^Clicar\s+/i, '')
          .trim();
        // Use text selector — much more robust than CSS :has-text()
        clickSelector = hint;
        clickSelectorType = 'text';
        clickVal = hint;
      }
    }

    steps.push({
      action: 'click',
      label: raw,
      selectorType: clickSelectorType,
      selector: clickSelector,
      value: clickVal,
    });
  }

  // Prepend goto if not already present
  if (!hasInitialGoto && targetUrl) {
    steps.unshift({ action: 'goto', label: 'Acessar ' + targetUrl, value: targetUrl });
  }

  if (steps.length === 0) return null;

  console.log(
    '[AutomationParser] parsePortugueseRoteiro: ' + stepLines.length + ' passos do roteiro -> ' +
    steps.length + ' steps Playwright gerados deterministicamente.'
  );
  return steps;
}
