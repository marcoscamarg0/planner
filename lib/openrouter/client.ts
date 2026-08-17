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
  // Provedor 1: Google Gemini (Gratuito e Mais Confiável)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const geminiModels = [
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash"
    ];
    for (const gModel of geminiModels) {
      try {
        const systemMsg = messages.find(m => m.role === 'system')?.content || '';
        const userMsgs = messages.filter(m => m.role !== 'system');
        const contents = userMsgs.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const nativeBody: any = {
          contents,
          generationConfig: {
            temperature: options?.temperature ?? 0.4,
            maxOutputTokens: options?.max_tokens ?? 1024
          }
        };
        if (systemMsg) nativeBody.systemInstruction = { parts: [{ text: systemMsg }] };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nativeBody),
        });

        if (response.ok) {
          const data: any = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) return content;
        }
      } catch (e) {
        console.warn(`[AI Client] Falha Gemini ${gModel}:`, e);
      }
    }
  }

  // Provedor 2: Cerebras Cloud (Ultra-Rápido)
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (cerebrasKey) {
    try {
      const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + cerebrasKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.3-70b",
          messages,
          max_tokens: options?.max_tokens ?? 1024,
          temperature: options?.temperature ?? 0.4,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.warn("[AI Client] Falha Cerebras:", e);
    }
  }

  // Provedor 3: Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
    for (const gModel of groqModels) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + groqKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: gModel,
            messages,
            max_tokens: options?.max_tokens ?? 1024,
            temperature: options?.temperature ?? 0.4,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return content;
        }
      } catch (e) {
        console.warn(`[AI Client] Falha Groq ${gModel}:`, e);
      }
    }
  }

  // Provedor 4: Mistral AI
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + mistralKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages,
          max_tokens: options?.max_tokens ?? 1024,
          temperature: options?.temperature ?? 0.4,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.warn("[AI Client] Falha Mistral:", e);
    }
  }

  // Provedor 5: OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const model = options?.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Planner",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options?.max_tokens ?? 1024,
          temperature: options?.temperature ?? 0.4,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        return data.choices?.[0]?.message?.content ?? "";
      }
    } catch (e) {
      console.warn("[AI Client] Falha OpenRouter:", e);
    }
  }

  return "";
}
