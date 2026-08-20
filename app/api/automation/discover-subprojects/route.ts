import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface DiscoveredItem {
  id: string;
  title: string;
  target_url: string;
  description: string;
  category: string;
  emoji: string;
}

// Padrões estritos de URLs que NÃO são serviços prestados
const STRICT_NON_SERVICE_URL_PATTERNS = [
  /\/noticias\b/i,
  /\/noticia\b/i,
  /\/assuntos\b/i,
  /\/assunto\b/i,
  /\/orgaos\b/i,
  /\/acesso-a-informacao\b/i,
  /\/institucional\b/i,
  /\/galeria\b/i,
  /\/fotos\b/i,
  /\/videos?\b/i,
  /\/legislacao\b/i,
  /\/atos-normativos\b/i,
  /\/portarias\b/i,
  /\/comunicacao\b/i,
  /\/imprensa\b/i,
  /\/release\b/i,
  /\/estrutura-organizacional\b/i,
  /\/quem-e-quem\b/i,
  /\/agenda\b/i,
  /\/agenda-de-autoridades\b/i,
  /\/eventos?\b/i,
  /\/publicacoes\b/i,
  /\/documentos\b/i,
  /\/central-de-conteudos\b/i,
  /\/composicao\b/i,
  /\/historico\b/i,
  /\/conselhos\b/i,
  /\/colegiados\b/i,
  /\/secretaria\b/i,
  /\/secretarias\b/i,
  /\/departamento\b/i,
  /\/diretoria\b/i,
  /\/organograma\b/i,
  /\/sobre\b/i,
  /\/fale-conosco\b/i,
  /\/canais-de-atendimento\b/i,
  /\/perguntas-frequentes\b/i,
  /\/duvidas-frequentes\b/i,
  /\/politica-de-privacidade\b/i,
  /\/termos-de-uso\b/i,
  /\/acessibilidade\b/i,
];

// Padrões de títulos que NÃO são serviços prestados
const STRICT_NON_SERVICE_TITLE_PATTERNS = [
  /^(notícias?|últimas notícias|informes?|comunicados?)/i,
  /^(galeria|fotos|vídeos|áudios|mídia)/i,
  /^(institucional|sobre o|quem somos|história|missão|visão|valores)/i,
  /^(organograma|estrutura|composição|quem é quem|gabinete|ministro)/i,
  /^(legislação|leis|decretos|portarias|resoluções|normas)/i,
  /^(acesso à informação|dados abertos|transparência|auditoria)/i,
  /^(fale conosco|contato|ouvidoria geral|endereço|localização)/i,
  /^(acessibilidade|mapa do site|voltar ao topo|topo)/i,
  /^(política de privacidade|termos de uso|cookies)/i,
  /^(redes sociais|facebook|instagram|twitter|youtube|linkedin)/i,
  /^(conselhos?|comitês?|câmaras?|grupos? de trabalho)/i,
];

// Palavras-chave indicativas de serviços prestados
const SERVICE_ACTION_KEYWORDS = [
  "emitir", "emissão", "solicitar", "solicitação", "consultar", "consulta",
  "cadastrar", "cadastro", "cadastramento", "autorização", "autorizar",
  "licença", "licenciamento", "licenciar", "certidão", "certificado", "certificação",
  "declaração", "requerimento", "requerer", "protocolar", "protocolo",
  "outorga", "outorgar", "habilitação", "habilitar", "credenciamento", "credenciar",
  "registro", "registrar", "renovação", "renovar", "inscrição", "inscrever",
  "isenção", "recurso", "recorrer", "vistoria", "inspeção", "inspecionar",
  "pagamento", "taxa", "restituição", "reembolso", "agendamento", "agendar",
  "serviço", "serviços", "carta de serviço", "carta de serviços", "atendimento",
  "instalar", "aplicativo", "crlv", "crv", "infrator", "veículo", "veicular",
  "aet", "rntrc", "dnit", "antt", "anac", "antaq", "renavam", "cnh", "senatran", "cdt"
];

// Catálogo pré-configurado de serviços canônicos de Trânsito e Transporte Terrestre (Gov.br / Senatran / DNIT)
const GOVBR_TRANSITO_SERVICES: DiscoveredItem[] = [
  {
    id: "serv-cdt-1",
    title: "Instalar aplicativo CDT (Carteira Digital de Trânsito)",
    target_url: "https://www.gov.br/pt-br/servicos/obter-carteira-digital-de-transito",
    description: "CNH digital e CRLV digital com mesmo valor jurídico dos documentos físicos impressos.",
    category: "Habilitação e Documentos",
    emoji: "📱",
  },
  {
    id: "serv-placa-2",
    title: "Consultar online os dados de placa veicular",
    target_url: "https://www.gov.br/pt-br/servicos/consultar-placa-veicular",
    description: "Consulta de dados públicos de identificação de veículos no território nacional.",
    category: "Veículos e Fiscalização",
    emoji: "🔍",
  },
  {
    id: "serv-multas-dnit-3",
    title: "Consultar multas do DNIT",
    target_url: "https://www.gov.br/pt-br/servicos/consultar-multas-dnit",
    description: "Consulta de infrações e débitos de trânsito em rodovias federais operadas pelo DNIT.",
    category: "Infrações e Recursos",
    emoji: "🚦",
  },
  {
    id: "serv-renavam-4",
    title: "Consultar dados de veículo na base RENAVAM",
    target_url: "https://www.gov.br/pt-br/servicos/consultar-veiculo-no-portal-de-servicos-do-senatran",
    description: "Consulta detalhada de situação cadastral, restrições e histórico de veículos no Senatran.",
    category: "Veículos e Fiscalização",
    emoji: "🚗",
  },
  {
    id: "serv-habilitacao-5",
    title: "Consultar online dados de sua habilitação de trânsito",
    target_url: "https://www.gov.br/pt-br/servicos/minhas-habilitacoes",
    description: "Acesso e consulta do prontuário, validade e pontuação da CNH (Minhas Habilitações).",
    category: "Habilitação e Documentos",
    emoji: "🪪",
  },
  {
    id: "serv-crv-6",
    title: "Consultar informações do CRV atual do veículo (Validar CRV)",
    target_url: "https://www.gov.br/pt-br/servicos/validar-crv",
    description: "Validação da autenticidade do Certificado de Registro de Veículo junto ao Senatran.",
    category: "Veículos e Fiscalização",
    emoji: "📄",
  },
  {
    id: "serv-infrator-7",
    title: "Identificação do Condutor Infrator (Transferência de Pontuação)",
    target_url: "https://www.gov.br/pt-br/servicos/transferencia-de-pontuacao",
    description: "Indicação online do real infrator e transferência de pontuação de penalidades de trânsito.",
    category: "Infrações e Recursos",
    emoji: "⚖️",
  },
  {
    id: "serv-meus-veiculos-8",
    title: "Consultar online dados de seus veículos (Meus Veículos)",
    target_url: "https://www.gov.br/pt-br/servicos/meus-veiculos",
    description: "Acesso à lista de veículos registrados no CPF do cidadão no Portal de Serviços do Senatran.",
    category: "Veículos e Fiscalização",
    emoji: "🚘",
  },
  {
    id: "serv-aet-9",
    title: "Emitir Autorização Especial de Trânsito (AET - DNIT)",
    target_url: "https://www.gov.br/dnit/pt-br/servicos/aet",
    description: "Emissão e consulta de autorização especial para transporte de cargas superdimensionadas.",
    category: "Transporte de Cargas",
    emoji: "🚚",
  },
  {
    id: "serv-rntrc-10",
    title: "Solicitar Registro Nacional de Transportadores Rodoviários (RNTRC - ANTT)",
    target_url: "https://www.gov.br/antt/pt-br/assuntos/cargas/rntrc",
    description: "Inscrição e renovação do registro obrigatório para transportadores de carga no Brasil.",
    category: "Transporte de Cargas",
    emoji: "🚛",
  },
  {
    id: "serv-certidao-11",
    title: "Emitir Certidão de Prontuário de Habilitação",
    target_url: "https://www.gov.br/pt-br/servicos/emitir-certidao-de-prontuario-de-cnh",
    description: "Emissão de certidão de histórico de habilitação para fins profissionais e viagens.",
    category: "Habilitação e Documentos",
    emoji: "📑",
  },
  {
    id: "serv-debitos-12",
    title: "Emitir Certidão Negativa de Débitos de Trânsito",
    target_url: "https://www.gov.br/dnit/pt-br/servicos/certidao-negativa",
    description: "Emissão de comprovante de quitação e ausência de débitos rodoviários.",
    category: "Infrações e Recursos",
    emoji: "✅",
  },
];

function isLikelyService(url: string, title: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase().trim();

  // 1. Rejeita se bater em padrões proibidos de URL
  if (STRICT_NON_SERVICE_URL_PATTERNS.some((p) => p.test(lowerUrl))) {
    return false;
  }

  // 2. Rejeita se bater em padrões proibidos de Título
  if (STRICT_NON_SERVICE_TITLE_PATTERNS.some((p) => p.test(lowerTitle))) {
    return false;
  }

  // 3. Verifica se a URL contém indicador de serviço
  if (
    lowerUrl.includes("/servicos/") ||
    lowerUrl.includes("/servico/") ||
    lowerUrl.includes("/carta-de-servicos/") ||
    lowerUrl.includes("/atendimento/") ||
    lowerUrl.includes("/sistemas/") ||
    lowerUrl.includes("/solicitar/") ||
    lowerUrl.includes("/consultar/") ||
    lowerUrl.includes("/emitir/") ||
    lowerUrl.includes("/servicos-prestados/")
  ) {
    return true;
  }

  // 4. Verifica se o título possui palavras-chave de ação ou serviço
  if (SERVICE_ACTION_KEYWORDS.some((kw) => lowerTitle.includes(kw))) {
    return true;
  }

  return false;
}

// Scraper dinâmico com Playwright para páginas JS/Gov.br
async function scrapeWithPlaywright(targetUrl: string): Promise<Array<{ text: string; url: string; description?: string }>> {
  let browser: any;
  try {
    const pw = await import("@playwright/test");
    browser = await pw.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const items = await page.evaluate(() => {
      const results: Array<{ text: string; url: string; description?: string }> = [];
      const seen = new Set<string>();

      // Seleciona itens de serviço, links e cartões
      const nodes = document.querySelectorAll("a, .card, li, .tileItem, .service-item");
      nodes.forEach((el) => {
        const link = el.tagName === "A" ? (el as HTMLAnchorElement) : el.querySelector("a");
        if (!link || !link.href) return;

        const href = link.href.split("#")[0];
        if (seen.has(href)) return;

        const titleEl = el.querySelector("h2, h3, h4, .title, strong, b") || link;
        const title = (titleEl.textContent || link.textContent || "").replace(/\s+/g, " ").trim();

        const descEl = el.querySelector("p, .description, .subtitle, .card-subtitle");
        const desc = descEl ? (descEl.textContent || "").replace(/\s+/g, " ").trim() : "";

        if (title.length >= 4 && href.startsWith("http")) {
          seen.add(href);
          results.push({ text: title, url: href, description: desc });
        }
      });

      return results;
    });

    await browser.close();
    return items;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return [];
  }
}

// Extração e filtragem estrita com IA (Gemini / OpenRouter)
async function extractServicesWithAi(htmlSnippet: string, rootUrl: string, candidateLinks: any[]): Promise<DiscoveredItem[]> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiKey = OPENROUTER_API_KEY;

  const promptText = `Você é um Auditor Especialista em Cartas de Serviços ao Cidadão e Governo Digital (Gov.br).
Sua tarefa é analisar os dados extraídos da página raiz: "${rootUrl}" e identificar EXCLUSIVAMENTE OS SERVIÇOS PRESTADOS.

REGRAS CRÍTICAS E OBRIGATÓRIAS DE FILTRAGEM (FILTRO ESTRITO DE SERVIÇOS):
1. RETORNE APENAS SERVIÇOS PRESTADOS ao cidadão, à empresa ou à sociedade (onde o usuário pode SOLICITAR, EMITIR, CONSULTAR, CADASTRAR, PROTOCOLAR, AUTORIZAR, RENOVAR, LICENCIAR ou ACESSAR UM SISTEMA/SERVIÇO OPERACIONAL).
2. É ESTRITAMENTE PROIBIDO incluir:
   - Notícias, comunicados, boletins informativos ou releases de imprensa.
   - Páginas institucionais (Quem é quem, Biografia de ministros, História do órgão, Estrutura organizacional, Organograma).
   - Legislações, leis, decretos, portarias em texto seco.
   - Menus gerais, links de rodapé, ouvidoria institucional genérica, termos de uso ou políticas.
3. Formate o 'title' iniciando com verbos de ação ou nomes canônicos de serviços (Ex: "Instalar aplicativo CDT", "Consultar online os dados de placa veicular", "Consultar multas do DNIT", "Consultar dados de veículo na base RENAVAM").
4. Atribua emojis adequados a serviços de transporte e trânsito (Ex: 📱, 🚗, 🚦, 🪪, 🚚, 📋, 🛂, 💳).

LINKS CANDIDATOS FILTRADOS:
${JSON.stringify(candidateLinks.slice(0, 100), null, 2)}

TRECHO DO HTML DA PÁGINA:
${htmlSnippet.slice(0, 8000)}

Retorne APENAS o JSON no formato:
{
  "items": [
    {
      "title": "Nome da Ação do Serviço Prestado",
      "target_url": "https://...",
      "description": "Explicação concisa do que este serviço presta ao cidadão/empresa.",
      "category": "Categoria (Ex: Habilitação e Documentos, Veículos e Fiscalização, Infrações e Recursos, Transporte de Cargas)",
      "emoji": "📋"
    }
  ]
}`;

  // 1. Tenta Google Gemini
  if (geminiKey) {
    try {
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 6000 },
        }),
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            const strictlyFiltered = parsed.items.filter((it: any) => {
              const t = String(it.title || "").toLowerCase();
              const u = String(it.target_url || "").toLowerCase();
              return (
                !STRICT_NON_SERVICE_TITLE_PATTERNS.some((p) => p.test(t)) &&
                !STRICT_NON_SERVICE_URL_PATTERNS.some((p) => p.test(u))
              );
            });

            return strictlyFiltered.map((it: any, i: number) => ({
              id: `serv-${Date.now()}-${i + 1}`,
              title: String(it.title || "Serviço " + (i + 1)).trim(),
              target_url: String(it.target_url || rootUrl).trim(),
              description: String(it.description || "").trim(),
              category: String(it.category || "Serviços Prestados").trim(),
              emoji: String(it.emoji || "📋").trim(),
            }));
          }
        }
      }
    } catch (gErr) {
      console.warn("[discover-subprojects] Falha no Gemini:", gErr);
    }
  }

  // 2. Tenta OpenRouter
  if (apiKey) {
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://planner-j53e.onrender.com",
          "X-Title": "Planner Service Discovery",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: promptText }],
          temperature: 0.1,
          max_tokens: 6000,
        }),
      });
      if (orRes.ok) {
        const orData = await orRes.json();
        const text = orData.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            const strictlyFiltered = parsed.items.filter((it: any) => {
              const t = String(it.title || "").toLowerCase();
              const u = String(it.target_url || "").toLowerCase();
              return (
                !STRICT_NON_SERVICE_TITLE_PATTERNS.some((p) => p.test(t)) &&
                !STRICT_NON_SERVICE_URL_PATTERNS.some((p) => p.test(u))
              );
            });

            return strictlyFiltered.map((it: any, i: number) => ({
              id: `serv-${Date.now()}-${i + 1}`,
              title: String(it.title || "Serviço " + (i + 1)).trim(),
              target_url: String(it.target_url || rootUrl).trim(),
              description: String(it.description || "").trim(),
              category: String(it.category || "Serviços Prestados").trim(),
              emoji: String(it.emoji || "📋").trim(),
            }));
          }
        }
      }
    } catch (orErr) {
      console.warn("[discover-subprojects] Falha no OpenRouter:", orErr);
    }
  }

  // 3. Fallback Heurístico Estrito
  return candidateLinks
    .filter((c) => isLikelyService(c.url, c.text))
    .map((c, i) => ({
      id: `serv-heur-${Date.now()}-${i + 1}`,
      title: c.text,
      target_url: c.url,
      description: c.description || `Serviço prestado identificado no portal ${rootUrl}`,
      category: "Serviços Prestados",
      emoji: "📋",
    }));
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let rootUrl = String(body.rootUrl || "").trim();

    if (!rootUrl) {
      return NextResponse.json({ error: "Informe a URL do site raiz ou Carta de Serviços." }, { status: 400 });
    }

    if (!rootUrl.startsWith("http://") && !rootUrl.startsWith("https://")) {
      rootUrl = "https://" + rootUrl;
    }

    let urlObj: URL;
    try {
      urlObj = new URL(rootUrl);
    } catch {
      return NextResponse.json({ error: "URL inválida." }, { status: 400 });
    }

    // Identificação rápida de páginas da categoria Trânsito do Gov.br
    const isGovBrTransito =
      rootUrl.includes("/transito") ||
      rootUrl.includes("/transporte-terrestre") ||
      rootUrl.includes("/carta-de-servicos/senatran") ||
      rootUrl.includes("/carta-de-servicos/dnit");

    // 1. Fetch da página HTML com Headers de navegador
    let html = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(rootUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
        },
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        html = await res.text();
      }
    } catch (fetchErr: any) {
      console.warn(`[discover-subprojects] Fetch simples falhou para ${rootUrl}:`, fetchErr.message);
    }

    // 2. Extração do título da página
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rootTitle = titleMatch
      ? titleMatch[1].replace(/\s+/g, " ").trim()
      : isGovBrTransito
      ? "Trânsito e Transportes Terrestres (Gov.br)"
      : urlObj.hostname;

    // 3. Extração de links da página
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const ignoredExtensions = /\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|css|js|zip|tar|gz|mp4|mp3|docx?|xlsx?|pptx?)$/i;
    const ignoredPatterns =
      /(whatsapp\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|t\.me|mailto:|tel:|javascript:|#)/i;

    const seenUrls = new Set<string>();
    const candidateLinks: Array<{ text: string; url: string; description?: string }> = [];

    if (html) {
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const rawHref = match[1].trim();
        const rawText = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        if (!rawHref || ignoredPatterns.test(rawHref) || ignoredExtensions.test(rawHref)) {
          continue;
        }

        let absoluteUrl = "";
        try {
          absoluteUrl = new URL(rawHref, rootUrl).href;
        } catch {
          continue;
        }

        const cleanUrl = absoluteUrl.split("#")[0];
        if (cleanUrl === rootUrl || cleanUrl === rootUrl + "/" || seenUrls.has(cleanUrl) || rawText.length < 3) {
          continue;
        }

        if (!isLikelyService(cleanUrl, rawText)) {
          continue;
        }

        seenUrls.add(cleanUrl);
        candidateLinks.push({ text: rawText, url: cleanUrl });
        if (candidateLinks.length >= 80) break;
      }
    }

    // 4. Se poucos links foram encontrados via fetch estático, aciona Playwright headless
    if (candidateLinks.length < 4) {
      const pwLinks = await scrapeWithPlaywright(rootUrl);
      pwLinks.forEach((pw) => {
        if (!seenUrls.has(pw.url) && isLikelyService(pw.url, pw.text)) {
          seenUrls.add(pw.url);
          candidateLinks.push(pw);
        }
      });
    }

    // 5. Se for Gov.br Trânsito e a página bloquear raspagem, funde com catálogo canônico
    if (isGovBrTransito || candidateLinks.length === 0) {
      if (isGovBrTransito) {
        const existingUrls = new Set(candidateLinks.map((c) => c.url));
        GOVBR_TRANSITO_SERVICES.forEach((s) => {
          if (!existingUrls.has(s.target_url)) {
            candidateLinks.push({ text: s.title, url: s.target_url, description: s.description });
          }
        });
      }
    }

    if (candidateLinks.length === 0) {
      return NextResponse.json({
        rootUrl,
        rootTitle,
        totalFound: 0,
        items: [],
        message:
          "Nenhum serviço prestado foi identificado nesta página. Verifique se o endereço é uma Carta de Serviços ou catálogo de atendimento.",
      });
    }

    // 6. Estruturação final com IA especializada
    let items = await extractServicesWithAi(html, rootUrl, candidateLinks);

    // Se o retorno da IA estiver vazio ou menor que o catálogo canônico para páginas de trânsito, combina os serviços
    if (isGovBrTransito && items.length < 5) {
      items = GOVBR_TRANSITO_SERVICES;
    }

    return NextResponse.json({
      rootUrl,
      rootTitle,
      totalFound: items.length,
      items,
      message: `Encontrados ${items.length} serviços prestados com sucesso.`,
    });
  } catch (err: any) {
    console.error("[discover-subprojects Error]:", err);
    return NextResponse.json(
      {
        error: err.message || "Falha interna ao descobrir subprojetos.",
      },
      { status: 500 }
    );
  }
}
