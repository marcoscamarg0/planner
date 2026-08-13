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
// Detect if input is already a JSON steps array/object
// Returns parsed steps or null if not detectable
// -------------------------------------------------------
export function tryParseDirectSteps(input: string): AutomationStep[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // --- NATIVE PARSING: Playwright Codegen JSONL ---
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
              // example: internal:role=link[name="Iniciar"i]
              const match = sel.match(/internal:role=([^\[]+)\[name=\"?([^\"]+?)\"?i?\]/);
              if (match) {
                val = match[2]; // name
                type = match[1]; // role (e.g., 'link', 'button')
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
        console.log('[AutomationParser] Parse nativo de Playwright Codegen: ' + pwSteps.length + ' passos gerados (limpos).');
        return pwSteps;
      }
    }
  }

  // --- FALLBACK: Tentar extrair do formato JSON gerado pela IA ---
  const candidates = [trimmed];

  if (trimmed.startsWith('[')) {
    candidates.push('{"steps":' + trimmed + '}');
  }

  if (trimmed.startsWith('{') && trimmed.includes('"action"')) {
    const wrapped = '[' + trimmed.replace(/\}\s*,?\s*\{/g, '},{') + ']';
    candidates.push('{"steps":' + wrapped + '}');
  }

  if (trimmed.includes('"action"')) {
    candidates.push(trimmed);
  }

  for (const candidate of candidates) {
    try {
      const parsed = robustJsonParse(candidate);
      if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const valid = parsed.steps.filter((s: any) => typeof s.action === 'string');
        if (valid.length > 0) {
          console.log('[AutomationParser] Passos detectados diretamente no input: ' + valid.length);
          return valid as AutomationStep[];
        }
      }
    } catch { /* next */ }
  }
  return null;
}

// -------------------------------------------------------
// Deterministic parser: converts numbered PT-BR roteiro
// steps into SmartStep[] without any AI call.
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
 * e.g. `Clicar no card "Denúncia"` → `Denúncia`
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
 * Parses a numbered PT-BR QA roteiro into SmartStep[].
 * Returns null if the input is not a human-readable roteiro
 * (e.g. it's raw JSON or Playwright codegen — handled elsewhere).
 */
export function parsePortugueseRoteiro(
  input: string,
  targetUrl: string
): ParsedSmartStep[] | null {
  const trimmed = input.trim();

  // If it starts with JSON characters, skip this parser
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null;
  // If it contains no numbered steps at all, skip
  if (!/^\s*\d+\./m.test(trimmed)) return null;

  // Extract all numbered steps (lines starting with "1.", "2.", etc.)
  const stepLines: string[] = [];
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*\d+\.\s+(.+)/);
    if (m) stepLines.push(m[1].trim());
  }

  if (stepLines.length === 0) return null;

  const steps: ParsedSmartStep[] = [];

  // Always start with goto + wait
  steps.push({ action: 'goto', label: 'Acessar ' + targetUrl, value: targetUrl });

  for (const raw of stepLines) {
    const lower = raw.toLowerCase();

    // NAVIGATE / GOTO
    if (
      lower.startsWith('navegar') || lower.startsWith('acessar') ||
      lower.startsWith('ir para') || lower.startsWith('abrir') ||
      lower.startsWith('entrar em') || lower.startsWith('visitar')
    ) {
      const url = extractUrl(raw) || targetUrl;
      steps.push({ action: 'goto', label: raw, value: url });
      continue;
    }

    // SCROLL
    if (lower.includes('rolar') || lower.includes('scroll')) {
      steps.push({ action: 'scroll', label: raw });
      continue;
    }

    // WAIT
    if (lower.startsWith('aguardar') || lower.startsWith('esperar') || lower.startsWith('wait')) {
      const msMatch = raw.match(/(\d+)\s*(ms|milissegundo|segundo)/i);
      const ms = msMatch
        ? parseInt(msMatch[1]) * (msMatch[2].toLowerCase().startsWith('s') ? 1000 : 1)
        : 2000;
      steps.push({ action: 'wait', label: raw, milliseconds: ms });
      continue;
    }

    // HOVER
    if (lower.startsWith('passar o mouse') || lower.startsWith('hover')) {
      const quoted = extractQuoted(raw);
      if (quoted) {
        steps.push({ action: 'hover', label: raw, selectorType: 'text', selector: quoted, value: quoted });
      }
      continue;
    }

    // TYPE / FILL
    if (
      lower.startsWith('preencher') || lower.startsWith('digitar') ||
      lower.startsWith('inserir') || lower.startsWith('escrever') ||
      lower.startsWith('fill') || lower.startsWith('type')
    ) {
      const fieldMatch = raw.match(/["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]\s+com\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i);
      if (fieldMatch) {
        steps.push({ action: 'type', label: raw, selectorType: 'text', selector: fieldMatch[1], value: fieldMatch[2] });
      } else {
        const quoted = extractQuoted(raw);
        if (quoted) steps.push({ action: 'type', label: raw, selectorType: 'text', selector: quoted, value: '' });
      }
      continue;
    }

    // CHECK / MARCAR
    if (lower.startsWith('marcar') || lower.startsWith('desmarcar') || lower.startsWith('check')) {
      const quoted = extractQuoted(raw);
      if (quoted) steps.push({ action: 'check', label: raw, selectorType: 'text', selector: quoted, value: quoted });
      continue;
    }

    // SELECT / SELECIONAR
    if (lower.startsWith('selecionar') || lower.startsWith('escolher')) {
      const quoted = extractQuoted(raw);
      if (quoted) steps.push({ action: 'select', label: raw, selectorType: 'text', selector: quoted, value: quoted });
      continue;
    }

    // CLICK (default for everything else)
    const quoted = extractQuoted(raw);
    if (quoted) {
      steps.push({ action: 'click', label: raw, selectorType: 'text', selector: quoted, value: quoted });
    } else {
      // Strip verb prefix and use the rest as selector hint
      const selectorHint = raw
        .replace(/^Clicar\s+(no|na|nos|nas|em|no\s+bot[a\u00e3]o|no\s+link|no\s+card|no\s+menu|no\s+item)\s+/i, '')
        .replace(/^Clicar\s+/i, '')
        .trim();
      steps.push({ action: 'click', label: raw, selectorType: 'text', selector: selectorHint, value: selectorHint });
    }
  }

  console.log(
    '[AutomationParser] parsePortugueseRoteiro: ' + stepLines.length + ' passos do roteiro \u2192 ' +
    steps.length + ' steps Playwright gerados deterministicamente.'
  );
  return steps;
}
