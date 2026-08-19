import { NextResponse } from "next/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

async function safeCreateAttribute(fn: () => Promise<any>, name: string, logs: string[]) {
  try {
    await fn();
    logs.push(`  + Atributo "${name}" criado`);
  } catch (e: any) {
    if (e.message?.includes("already exists") || e.message?.includes("409")) {
      // Já existe, tudo bem
    } else {
      logs.push(`  ! Atributo "${name}": ${e.message}`);
    }
  }
}

export async function GET() {
  const dbId = appwriteConfig.databaseId;
  const logs: string[] = [];

  const apiKey = process.env.APPWRITE_API_KEY || appwriteConfig.apiKey;

  if (!apiKey || apiKey.trim().length < 5) {
    return NextResponse.json(
      {
        success: false,
        error: "A chave APPWRITE_API_KEY não foi encontrada no .env.local.",
      },
      { status: 400 }
    );
  }

  try {
    // 1. Garante o Banco de Dados
    try {
      await appwriteRest.createDatabase(dbId, "Planner Database");
      logs.push(`🎉 Banco de dados "${dbId}" criado com sucesso!`);
    } catch (e: any) {
      logs.push(`✅ Banco de dados "${dbId}" pronto.`);
    }

    // 2. Coleção projects
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.projects, "Projetos");
      logs.push(`🎉 Coleção "${appwriteConfig.collections.projects}" criada.`);
    } catch {}
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "title", 500, true), "title", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "description", 5000, false), "description", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "color", 50, false, "#0C326F"), "color", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "emoji", 20, false, "📁"), "emoji", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "status", 50, false, "active"), "status", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "parent_id", 100, false), "parent_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "owner_id", 100, false), "owner_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "user_id", 100, false), "user_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "target_url", 2000, false), "target_url", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "flow_data", 100000, false), "flow_data", logs);

    // 3. Coleção tasks
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.tasks, "Tarefas");
      logs.push(`🎉 Coleção "${appwriteConfig.collections.tasks}" criada.`);
    } catch {}
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "project_id", 100, true), "project_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "page_id", 100, false), "page_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "title", 1000, true), "title", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "description", 10000, false), "description", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "status", 50, false, "todo"), "status", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "priority", 50, false, "medium"), "priority", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "due_date", 100, false), "due_date", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "parent_task_id", 100, false), "parent_task_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "user_id", 100, false), "user_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "assigned_to", 100, false), "assigned_to", logs);
    await safeCreateAttribute(() => appwriteRest.createIntegerAttribute(dbId, appwriteConfig.collections.tasks, "order_index", false, 0), "order_index", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "metadata", 100000, false), "metadata", logs);

    // 4. Coleção pages
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.pages, "Páginas");
      logs.push(`🎉 Coleção "${appwriteConfig.collections.pages}" criada.`);
    } catch {}
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "project_id", 100, true), "project_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "title", 500, true), "title", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "content", 100000, false), "content", logs);
    await safeCreateAttribute(() => appwriteRest.createIntegerAttribute(dbId, appwriteConfig.collections.pages, "order_index", false, 0), "order_index", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "user_id", 100, false), "user_id", logs);

    // 5. Coleção ai_insights
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.insights, "Insights IA");
      logs.push(`🎉 Coleção "${appwriteConfig.collections.insights}" criada.`);
    } catch {}
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "project_id", 100, true), "project_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "page_id", 100, false), "page_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "type", 50, true), "type", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "title", 500, false), "title", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "description", 5000, false), "description", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "content", 50000, true), "content", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "metadata", 100000, false), "metadata", logs);
    await safeCreateAttribute(() => appwriteRest.createBooleanAttribute(dbId, appwriteConfig.collections.insights, "is_read", false, false), "is_read", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "user_id", 100, false), "user_id", logs);

    // 6. Coleção qa_reports
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.qaReports, "Relatórios QA");
      logs.push(`🎉 Coleção "${appwriteConfig.collections.qaReports}" criada.`);
    } catch {}
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "project_id", 100, false), "project_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "user_id", 100, false), "user_id", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "type", 100, true), "type", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "title", 500, true), "title", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "input_prompt", 10000, false), "input_prompt", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "input_description", 10000, false), "input_description", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "framework", 100, false), "framework", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "model_used", 100, false), "model_used", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "result_raw", 100000, false), "result_raw", logs);
    await safeCreateAttribute(() => appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "result_json", 100000, false), "result_json", logs);

    return NextResponse.json({
      success: true,
      message: "Estrutura completa de coleções e atributos do Appwrite configurada com sucesso!",
      logs,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
