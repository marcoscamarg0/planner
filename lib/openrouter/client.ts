export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options?: {
    model?: string;
    max_tokens?: number;
    temperature?: number;
  }
): Promise<string> {
  let lastError: any;

  // Tentativa com OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const model =
        options?.model ??
        process.env.OPENROUTER_MODEL ??
        "meta-llama/llama-3.1-8b-instruct";

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer":
              process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
            "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Planner",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: options?.max_tokens ?? 512,
            temperature: options?.temperature ?? 0.4,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("[OpenRouter Fallback] Falha no OpenRouter:", response.status, errorText);
        throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      return data.choices[0]?.message?.content ?? "";
    } catch (e: any) {
      lastError = e;
    }
  }

  // Fallback para Groq
  if (process.env.GROQ_API_KEY) {
    try {
      console.log("[OpenRouter Fallback] Tentando API da Groq...");
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            max_tokens: options?.max_tokens ?? 512,
            temperature: options?.temperature ?? 0.4,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content ?? "";
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError || new Error("Nenhuma API de IA disponível ou todas falharam.");
}
