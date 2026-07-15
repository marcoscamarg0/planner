import type { OpenRouterMessage } from "./client";

const GOV_CONTEXT = `Você é o "Segundo Cérebro", um Assessor Executivo de Projetos de Alto Nível focado estritamente no Ministério dos Transportes e Governo Federal do Brasil. Você deve entender contextos de infraestrutura, concessões rodoviárias e ferroviárias, licitações, políticas públicas e gestão estratégica. Mantenha um tom profissional, analítico e executivo. Responda sempre em português do Brasil.`;

export function buildSummarizePrompt(
  title: string,
  content: string
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} Faça um briefing executivo (resumo) conciso e preciso deste documento/anotação. Seja objetivo, máximo de 3 frases, destacando o impacto para a gestão pública ou infraestrutura.`,
    },
    {
      role: "user",
      content: `Faça o briefing do seguinte conteúdo:\n\nTítulo: ${title}\n\nConteúdo:\n${content}`,
    },
  ];
}

export function buildInsightPrompt(
  projectTitle: string,
  stats: {
    total_tasks: number;
    completed_tasks: number;
    pages_count: number;
    status: string;
  }
): OpenRouterMessage[] {
  const completion_rate =
    stats.total_tasks > 0
      ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
      : 0;

  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} Gere uma recomendação estratégica curta (1 frase) sobre o andamento físico-financeiro ou progresso gerencial do projeto. Fale como um Ministro ou Secretário de Infraestrutura guiando sua equipe.`,
    },
    {
      role: "user",
      content: `Projeto: "${projectTitle}"\nStatus: ${stats.status}\nDemandas atendidas: ${stats.completed_tasks}/${stats.total_tasks} (${completion_rate}%)\nDocumentos: ${stats.pages_count}\n\nGere um insight executivo sobre este progresso.`,
    },
  ];
}

export function buildSuggestTasksPrompt(
  projectTitle: string,
  projectDescription: string,
  existingTasks: string[]
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} Sugira ações executivas (tarefas) faltantes necessárias para avançar com o projeto (ex: elaborar nota técnica, aprovação na TCU, minuta de portaria, reunião com concessionária). Retorne apenas um JSON array de strings com as tarefas.`,
    },
    {
      role: "user",
      content: `Projeto: "${projectTitle}"\nDescrição: ${projectDescription || "Não informada"}\nDemandas já cadastradas: ${existingTasks.length > 0 ? existingTasks.join(", ") : "Nenhuma"}\n\nSugira 5 passos críticos necessários. Retorne apenas o JSON array.`,
    },
  ];
}

export function buildPrioritizePrompt(
  tasks: { title: string; due_date: string | null; priority: string }[]
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} Analise e priorize essas pautas governamentais. Retorne um JSON array estrito contendo: [{id_index, justificativa_estrategica}].`,
    },
    {
      role: "user",
      content: `Pautas para priorizar:\n${JSON.stringify(tasks, null, 2)}\n\nRetorne o JSON array ordenado do mais para o menos urgente.`,
    },
  ];
}

export function buildMagicAddPrompt(text: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} O usuário vai colar uma mensagem bruta (do Microsoft Teams, e-mail, WhatsApp, ata de reunião etc.) e você deve estruturar isso para um projeto específico. Extraia: 1) Demandas/Tarefas acionáveis (com título, prioridade inferida ['low', 'medium', 'high', 'urgent'] e prazo inferido no formato "YYYY-MM-DD" se mencionado, ou null); 2) Um resumo executivo consolidando o assunto da mensagem em até 4 frases, direto ao ponto, destacando decisões, pendências e responsáveis se mencionados. Ignore saudações, assinaturas e ruído de conversa. Responda EXATAMENTE com um JSON válido: { "tasks": [{ "title": "string", "priority": "string", "due_date": "YYYY-MM-DD" | null }], "note": "string" | null }.`,
    },
    {
      role: "user",
      content: `Extraia as demandas (com datas de vencimento se houver) e o resumo executivo da seguinte mensagem colada:\n\n"${text}"\n\nRetorne apenas o JSON.`,
    },
  ];
}

export function buildIntentPrompt(
  command: string,
  projects: { id: string; title: string }[]
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} Você atua como o Command Center Global do usuário. O usuário vai enviar um comando natural (ex: "apague o projeto X", "mude o nome do projeto de rodovia para Y", "adicione a demanda Z no projeto X", "crie um projeto novo chamado W"). 
Você tem acesso à lista atual de projetos do usuário:
${JSON.stringify(projects)}

Sua tarefa é analisar o comando, identificar a ação desejada e retornar EXATAMENTE UM JSON válido, com o seguinte formato estrito:
{
  "intent": "delete_project" | "edit_project" | "create_project" | "create_tasks" | "unknown",
  "target_project_id": "string com o UUID do projeto alvo se encontrado na lista, senao null",
  "new_project_title": "string (se a intenção for create_project ou edit_project)",
  "tasks": [ { "title": "string", "priority": "low|medium|high|urgent", "due_date": "YYYY-MM-DD" | null } ],
  "note": "string"
}
Aja com precisão cirúrgica na classificação da intenção.`,
    },
    {
      role: "user",
      content: `Comando: "${command}"\n\nRetorne apenas o JSON, sem formatação markdown.`,
    },
  ];
}

export function buildChatPrompt(
  history: { role: string; content: string }[],
  contextData: any
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `${GOV_CONTEXT} Você é o Segundo Cérebro do usuário, um chatbot avançado operando dentro da plataforma de gestão.
Sua função principal é cruzar os DADOS PRIVADOS DO USUÁRIO (projetos, tarefas e REFERÊNCIAS anexadas por ele — links, PDFs e textos) com seu conhecimento geral para dar respostas super completas.

=== DADOS PRIVADOS DO USUÁRIO (RAG) ===
${JSON.stringify(contextData)}
=========================================

Instruções sobre "reference_sources": são links, PDFs e anotações de texto que o usuário anexou manualmente como material de referência. Sempre que a pergunta do usuário se relacionar ao conteúdo de uma dessas fontes, cite explicitamente qual referência (pelo título) você está usando e extraia/puxe as informações relevantes dela antes de complementar com conhecimento geral. Se nenhuma referência for relevante, ignore-as silenciosamente. Responda sempre de forma direta, clara e formatada em markdown.`
    },
    ...history.map(msg => ({
      role: msg.role as any,
      content: msg.content
    }))
  ];
}
