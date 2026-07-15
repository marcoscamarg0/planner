const MAX_CONTENT_CHARS = 12000;

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|p|div|section|article|li|h[1-6]|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(withoutNoise)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  return { title, text };
}

export async function extractFromUrl(
  url: string
): Promise<{ title: string; content: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Apenas URLs http/https são suportadas");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PlannerBot/1.0; +https://planner.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(`Não foi possível acessar o link (status ${res.status})`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text")) {
      throw new Error("O link não retornou conteúdo de texto/HTML legível");
    }

    const html = await res.text();
    const { title, text } = stripHtml(html);

    return {
      title: title || parsed.hostname,
      content: text.slice(0, MAX_CONTENT_CHARS),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  // pdf-parse is CJS; dynamic import keeps it out of the client bundle.
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return (data.text || "").trim().slice(0, MAX_CONTENT_CHARS);
}

export function clampText(text: string): string {
  return text.slice(0, MAX_CONTENT_CHARS);
}
