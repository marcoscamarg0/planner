import { NextResponse } from "next/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbId = appwriteConfig.databaseId;
  const logs: string[] = [];

  if (!appwriteConfig.apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "A variável APPWRITE_API_KEY não foi encontrada no seu .env.local.",
        instrucoes: [
          "1. Abra seu painel no Appwrite Cloud (cloud.appwrite.io)",
          "2. Vá em Settings / API Keys e crie uma chave (Nome: Planner Server Key)",
          "3. Marque as permissões de databases, collections, attributes e documents",
          "4. Cole no seu .env.local: APPWRITE_API_KEY=sua_chave",
          "5. Recarregue esta página",
        ],
      },
      { status: 400 }
    );
  }

  try {
    // 1. Cria ou garante o Banco de Dados
    try {
      await appwriteRest.createDatabase(dbId, "Planner Database");
      logs.push(`🎉 Banco de dados "${dbId}" criado com sucesso!`);
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("409")) {
        logs.push(`✅ Banco de dados "${dbId}" já existe.`);
      } else {
        logs.push(`ℹ️ Banco "${dbId}": ${e.message}`);
      }
    }

    // 2. Cria Coleção projects
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.projects, "Projetos");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "title", 255, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "description", 2000, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "color", 50, false, "#0C326F");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "emoji", 20, false, "📁");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "status", 50, false, "active");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "parent_id", 100, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "owner_id", 100, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "target_url", 1000, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.projects, "flow_data", 50000, false);
      logs.push(`🎉 Coleção "${appwriteConfig.collections.projects}" criada com sucesso!`);
    } catch (e: any) {
      logs.push(`ℹ️ Coleção "${appwriteConfig.collections.projects}": ${e.message}`);
    }

    // 3. Cria Coleção tasks
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.tasks, "Tarefas");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "project_id", 100, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "page_id", 100, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "title", 500, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "description", 4000, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "status", 50, false, "todo");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "priority", 50, false, "medium");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "due_date", 100, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "parent_task_id", 100, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.tasks, "metadata", 50000, false);
      logs.push(`🎉 Coleção "${appwriteConfig.collections.tasks}" criada com sucesso!`);
    } catch (e: any) {
      logs.push(`ℹ️ Coleção "${appwriteConfig.collections.tasks}": ${e.message}`);
    }

    // 4. Cria Coleção pages
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.pages, "Páginas");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "project_id", 100, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "title", 255, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.pages, "content", 100000, false);
      await appwriteRest.createIntegerAttribute(dbId, appwriteConfig.collections.pages, "order_index", false, 0);
      logs.push(`🎉 Coleção "${appwriteConfig.collections.pages}" criada com sucesso!`);
    } catch (e: any) {
      logs.push(`ℹ️ Coleção "${appwriteConfig.collections.pages}": ${e.message}`);
    }

    // 5. Cria Coleção ai_insights
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.insights, "Insights IA");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "project_id", 100, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "type", 50, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.insights, "content", 5000, true);
      await appwriteRest.createBooleanAttribute(dbId, appwriteConfig.collections.insights, "is_read", false, false);
      logs.push(`🎉 Coleção "${appwriteConfig.collections.insights}" criada com sucesso!`);
    } catch (e: any) {
      logs.push(`ℹ️ Coleção "${appwriteConfig.collections.insights}": ${e.message}`);
    }

    // 6. Cria Coleção qa_reports
    try {
      await appwriteRest.createCollection(dbId, appwriteConfig.collections.qaReports, "Relatórios QA");
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "project_id", 100, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "type", 100, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "title", 255, true);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "input_prompt", 5000, false);
      await appwriteRest.createStringAttribute(dbId, appwriteConfig.collections.qaReports, "result_json", 100000, false);
      logs.push(`🎉 Coleção "${appwriteConfig.collections.qaReports}" criada com sucesso!`);
    } catch (e: any) {
      logs.push(`ℹ️ Coleção "${appwriteConfig.collections.qaReports}": ${e.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Estrutura do Appwrite configurada com sucesso!",
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
