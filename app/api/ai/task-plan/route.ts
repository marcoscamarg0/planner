import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/openrouter/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskTitle, projectTitle, projectUrl, currentDescription } = await req.json();

    if (!taskTitle) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const sysPrompt = [
      "Você é um Especialista Sênior em Engenharia de Qualidade de Software (QA Lead) e Automação de Testes.",
      "Sua missão é criar uma Especificação e Plano de Teste Completo, Profissional e Executável para o caso de teste fornecido.",
      "O plano DEVE conter as seguintes seções em Markdown limpo:",
      "",
      "### 🎯 Objetivo do Teste",
      "(Descrição clara do que está sendo validado e o valor de negócio)",
      "",
      "### 📋 Pré-requisitos & Dados de Entrada",
      "- URL / Ambiente: " + (projectUrl || "Ambiente de Testes"),
      "- Credenciais / Massa de dados necessária",
      "- Estado inicial da aplicação",
      "",
      "### 📝 Roteiro de Execução (Passo a Passo)",
      "1. Acessar a página inicial...",
      "2. Localizar o componente / botão...",
      "3. Executar a ação de clique / preenchimento...",
      "4. Observar a transição ou redirecionamento...",
      "5. Validar o resultado na interface...",
      "",
      "### 🔍 Critérios de Aceite & Resultado Esperado",
      "- O sistema deve processar a requisição sem erros de JavaScript ou rede.",
      "- A interface deve apresentar o feedback visual ou redirecionamento correto.",
      "",
      "IMPORTANTE: Responda EXCLUSIVAMENTE em Português (PT-BR) com o Markdown estruturado. Não adicione introduções ou conversas."
    ].join("\n");

    const userPrompt = [
      "Projeto: " + (projectTitle || "Sistema Web"),
      "URL Alvo: " + (projectUrl || "https://..."),
      "Caso de Teste / Tarefa: " + taskTitle,
      currentDescription ? "Detalhes Adicionais Existentes:\n" + currentDescription : "",
      "\nEscreva o Plano de Teste detalhado com passos numerados para execução."
    ].join("\n");

    const plan = await callOpenRouter([
      { role: "system", content: sysPrompt },
      { role: "user", content: userPrompt }
    ], { max_tokens: 1500, temperature: 0.2 });

    if (!plan) {
      // Fallback determinístico caso nenhuma IA responda
      const fallbackPlan = `### 🎯 Objetivo do Teste
Validar o fluxo funcional e a integridade da funcionalidade: ${taskTitle}.

### 📋 Pré-requisitos & Dados de Entrada
- Acesso à URL: ${projectUrl || "Ambiente de Teste"}
- Navegador atualizado e conexão estável

### 📝 Roteiro de Execução (Passo a Passo)
1. Acessar a página inicial da aplicação
2. Navegar até a seção correspondente ao caso de teste
3. Executar as interações necessárias de preenchimento ou clique
4. Observar a resposta e integridade visual dos componentes
5. Registrar a evidência fotográfica da tela

### 🔍 Critérios de Aceite & Resultado Esperado
- Operação realizada com sucesso sem ocorrência de erros visuais ou de console.`;
      return NextResponse.json({ plan: fallbackPlan });
    }

    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error("AI task-plan error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
