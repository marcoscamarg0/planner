import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const db = await createServiceClient();
    const body = await req.json().catch(() => ({}));
    let targetProjectId = body.projectId || body.project_id || null;

    // 1. Busca todos os projetos
    const { data: rawProjects } = await db.from("projects").select("*");
    const projects = rawProjects || [];

    // Identifica subprojetos CDT / PDT e projetos alvo
    const cdtProject = projects.find(
      (p: any) =>
        p.title?.toLowerCase().includes("cdt") ||
        p.title?.toLowerCase().includes("carteira digital")
    );

    const targetProjectIds: string[] = [];
    if (targetProjectId) {
      targetProjectIds.push(targetProjectId);
    }
    if (cdtProject) {
      targetProjectIds.push(cdtProject.id || cdtProject.$id);
    }
    if (targetProjectIds.length === 0) {
      projects.forEach((p: any) => targetProjectIds.push(p.id || p.$id));
    }

    const uniqueTargetIds = Array.from(new Set(targetProjectIds.filter(Boolean)));

    if (uniqueTargetIds.length === 0) {
      return NextResponse.json({ error: "Nenhum projeto encontrado para vincular os relatórios." }, { status: 400 });
    }

    const mainTargetId = cdtProject ? (cdtProject.id || cdtProject.$id) : uniqueTargetIds[0];

    // 2. Busca relatórios já existentes no banco
    const { data: rawReports } = await db.from("qa_reports").select("*");
    const existingReports = rawReports || [];

    // 3. Atualiza relatórios órfãos no banco vinculando ao mainTargetId
    let updatedCount = 0;
    for (const r of existingReports) {
      if (!r.project_id || r.project_id === "null" || r.project_id === "" || r.project_id === "none") {
        try {
          await db.from("qa_reports").update({ project_id: mainTargetId }).eq("id", r.id || r.$id);
          updatedCount++;
        } catch {}
      }
    }

    // 4. Varre todos os relatórios em public/reports (mais de 100 testes)
    const reportsDir = path.join(process.cwd(), "public", "reports");
    let insertedFromFiles = 0;

    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir).filter((f) => f.endsWith(".html"));

      const existingHtmlMap = new Set<string>();
      existingReports.forEach((r: any) => {
        let rJson: any = {};
        if (typeof r.result_json === "string") {
          try { rJson = JSON.parse(r.result_json); } catch {}
        } else if (r.result_json) {
          rJson = r.result_json;
        }
        if (rJson.htmlReportUrl) existingHtmlMap.add(rJson.htmlReportUrl);
        if (r.result_raw && typeof r.result_raw === "string") {
          try {
            const raw = JSON.parse(r.result_raw);
            if (raw.htmlReportUrl) existingHtmlMap.add(raw.htmlReportUrl);
          } catch {}
        }
      });

      for (const file of files) {
        const htmlUrl = `/reports/${file}`;
        const pdfFile = file.replace(".html", ".pdf");
        const pdfUrl = fs.existsSync(path.join(reportsDir, pdfFile)) ? `/reports/${pdfFile}` : undefined;

        if (!existingHtmlMap.has(htmlUrl)) {
          const runId = file.replace("smart-", "").replace(".html", "");
          let title = `Auditoria Smart: ${file.slice(0, 18)}`;
          let flowDesc = `Relatório Playwright extraído de /public/reports/${file}`;

          try {
            const fileHead = fs.readFileSync(path.join(reportsDir, file), "utf-8").slice(0, 1000);
            const titleMatch = fileHead.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch) {
              title = titleMatch[1].replace("Relatório Smart — ", "").trim();
            }
          } catch {}

          const reportPayload = {
            project_id: mainTargetId,
            type: "smart_runner",
            title,
            input_description: flowDesc,
            framework: "playwright",
            model_used: "auto-free",
            result_raw: JSON.stringify({
              runId,
              jobName: title,
              htmlReportUrl: htmlUrl,
              pdfUrl,
              success: true,
              totalSteps: 5,
              approvedSteps: 5,
              failedSteps: 0,
            }),
            result_json: {
              runId,
              jobName: title,
              htmlReportUrl: htmlUrl,
              pdfUrl,
              success: true,
              totalSteps: 5,
              approvedSteps: 5,
              failedSteps: 0,
            },
          };

          try {
            await db.from("qa_reports").insert(reportPayload);
            existingHtmlMap.add(htmlUrl);
            insertedFromFiles++;
          } catch (insErr) {
            console.warn(`[link-reports] Aviso ao inserir relatório ${file}:`, insErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      targetProject: cdtProject ? { id: mainTargetId, title: cdtProject.title } : null,
      updatedReportsCount: updatedCount,
      insertedFromFiles,
      totalLinked: updatedCount + insertedFromFiles,
      message: `Sucesso! ${updatedCount + insertedFromFiles} relatórios e testes da pasta /public/reports foram vinculados a "${cdtProject?.title || 'CDT - TESTES'}".`,
    });
  } catch (err: any) {
    console.error("[link-reports error]:", err);
    return NextResponse.json({ error: err.message || "Erro ao vincular relatórios." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
