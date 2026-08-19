import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = {
    projectsMigrated: 0,
    tasksMigrated: 0,
    pagesMigrated: 0,
    insightsMigrated: 0,
    qaReportsMigrated: 0,
    errors: [] as string[],
    logs: [] as string[],
  };

  const dbId = appwriteConfig.databaseId;

  try {
    const supabase = await createServiceClient();

    // 1. MIGRAÇÃO DE PROJETOS
    try {
      const { data: projects, error: pErr } = await supabase.from("projects").select("*");
      if (pErr) throw pErr;

      if (projects && projects.length > 0) {
        for (const proj of projects) {
          try {
            await appwriteRest.createDocument(dbId, appwriteConfig.collections.projects, proj.id, {
              title: proj.title || "Sem título",
              description: proj.description || "",
              color: proj.color || "#0C326F",
              emoji: proj.emoji || "📁",
              status: proj.status || "active",
              parent_id: proj.parent_id || null,
              owner_id: proj.owner_id || "admin",
              target_url: proj.target_url || null,
              flow_data: proj.flow_data ? JSON.stringify(proj.flow_data) : null,
            });
            stats.projectsMigrated++;
          } catch (e: any) {
            // Se já existir, tenta atualizar
            try {
              await appwriteRest.updateDocument(dbId, appwriteConfig.collections.projects, proj.id, {
                title: proj.title || "Sem título",
                description: proj.description || "",
                color: proj.color || "#0C326F",
                emoji: proj.emoji || "📁",
                status: proj.status || "active",
                parent_id: proj.parent_id || null,
                target_url: proj.target_url || null,
              });
              stats.projectsMigrated++;
            } catch (upErr: any) {
              stats.errors.push(`Projeto ${proj.title}: ${e.message}`);
            }
          }
        }
        stats.logs.push(`✅ ${stats.projectsMigrated} projetos sincronizados para o Appwrite.`);
      }
    } catch (e: any) {
      stats.errors.push(`Erro ao ler projetos do Supabase: ${e.message}`);
    }

    // 2. MIGRAÇÃO DE TAREFAS
    try {
      const { data: tasks, error: tErr } = await supabase.from("tasks").select("*");
      if (tErr) throw tErr;

      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          try {
            await appwriteRest.createDocument(dbId, appwriteConfig.collections.tasks, task.id, {
              project_id: task.project_id,
              page_id: task.page_id || null,
              title: task.title,
              description: task.description || "",
              status: task.status || "todo",
              priority: task.priority || "medium",
              due_date: task.due_date || null,
              parent_task_id: task.parent_task_id || null,
              metadata: task.metadata ? JSON.stringify(task.metadata) : null,
            });
            stats.tasksMigrated++;
          } catch (e: any) {
            try {
              await appwriteRest.updateDocument(dbId, appwriteConfig.collections.tasks, task.id, {
                title: task.title,
                status: task.status || "todo",
                priority: task.priority || "medium",
              });
              stats.tasksMigrated++;
            } catch (upErr: any) {
              stats.errors.push(`Tarefa ${task.title}: ${e.message}`);
            }
          }
        }
        stats.logs.push(`✅ ${stats.tasksMigrated} tarefas sincronizadas para o Appwrite.`);
      }
    } catch (e: any) {
      stats.errors.push(`Erro ao ler tarefas do Supabase: ${e.message}`);
    }

    // 3. MIGRAÇÃO DE PÁGINAS
    try {
      const { data: pages, error: pgErr } = await supabase.from("pages").select("*");
      if (pgErr) throw pgErr;

      if (pages && pages.length > 0) {
        for (const page of pages) {
          try {
            await appwriteRest.createDocument(dbId, appwriteConfig.collections.pages, page.id, {
              project_id: page.project_id,
              title: page.title || "Nova página",
              content: page.content ? JSON.stringify(page.content) : null,
              order_index: page.order_index || 0,
            });
            stats.pagesMigrated++;
          } catch (e: any) {
            stats.errors.push(`Página ${page.title}: ${e.message}`);
          }
        }
        stats.logs.push(`✅ ${stats.pagesMigrated} páginas sincronizadas para o Appwrite.`);
      }
    } catch (e: any) {
      stats.errors.push(`Erro ao ler páginas do Supabase: ${e.message}`);
    }

    // 4. MIGRAÇÃO DE INSIGHTS
    try {
      const { data: insights, error: iErr } = await supabase.from("ai_insights").select("*");
      if (iErr) throw iErr;

      if (insights && insights.length > 0) {
        for (const insight of insights) {
          try {
            await appwriteRest.createDocument(dbId, appwriteConfig.collections.insights, insight.id, {
              project_id: insight.project_id,
              type: insight.type || "summary",
              content: insight.content || "",
              is_read: Boolean(insight.is_read),
            });
            stats.insightsMigrated++;
          } catch (e: any) {
            stats.errors.push(`Insight ${insight.id}: ${e.message}`);
          }
        }
        stats.logs.push(`✅ ${stats.insightsMigrated} insights de IA sincronizados.`);
      }
    } catch (e: any) {
      stats.errors.push(`Erro ao ler insights do Supabase: ${e.message}`);
    }

    // 5. MIGRAÇÃO DE RELATÓRIOS QA
    try {
      const { data: reports, error: rErr } = await supabase.from("qa_reports").select("*");
      if (rErr) throw rErr;

      if (reports && reports.length > 0) {
        for (const report of reports) {
          try {
            await appwriteRest.createDocument(dbId, appwriteConfig.collections.qaReports, report.id, {
              project_id: report.project_id || null,
              type: report.type || "test_cases",
              title: report.title || "Relatório de Testes",
              input_prompt: report.input_prompt || "",
              result_json: report.result_json ? JSON.stringify(report.result_json) : null,
            });
            stats.qaReportsMigrated++;
          } catch (e: any) {
            stats.errors.push(`Relatório QA ${report.title}: ${e.message}`);
          }
        }
        stats.logs.push(`✅ ${stats.qaReportsMigrated} relatórios QA sincronizados.`);
      }
    } catch (e: any) {
      stats.errors.push(`Erro ao ler relatórios do Supabase: ${e.message}`);
    }

    return NextResponse.json({
      status: "🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!",
      resumo: {
        projetos: stats.projectsMigrated,
        tarefas: stats.tasksMigrated,
        paginas: stats.pagesMigrated,
        insights: stats.insightsMigrated,
        relatorios_qa: stats.qaReportsMigrated,
      },
      detalhes: stats.logs,
      avisos: stats.errors.length > 0 ? stats.errors : ["Nenhum erro encontrado!"],
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "❌ Erro durante o processo de migração",
      erro: err.message,
      stats,
    }, { status: 500 });
  }
}
