import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

import { cleanOldReports } from '@/lib/utils/cleanup-reports';
import { createAppwriteClient } from '@/lib/appwrite/adapter';
import { buildReportHtml } from '@/lib/worker/report-generator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  // Executa limpeza de arquivos com mais de 3 dias de forma assíncrona
  cleanOldReports(3).catch(() => {});
  const { filename } = await params;

  // Determina o Content-Type pelo nome do arquivo
  let contentType = 'application/octet-stream';
  if (filename.endsWith('.pdf')) contentType = 'application/pdf';
  else if (filename.endsWith('.html')) contentType = 'text/html; charset=utf-8';

  // --- Serve arquivo do disco local (public/reports) ---
  const filePath = path.resolve(process.cwd(), 'public', 'reports', filename);

  if (!fs.existsSync(filePath)) {
    // Tenta reconstruir dinamicamente a partir do histórico do banco de dados (qa_reports)
    try {
      const cleanId = filename.replace(/^smart-|^report-/, '').replace(/\.html$|\.pdf$/, '');
      const supabase = createAppwriteClient();
      const { data: reports } = await supabase
        .from('qa_reports')
        .select('id, title, result_raw, result_json');

      const found = (reports || []).find((r: any) => {
        if (r.id === cleanId) return true;
        const res = typeof r.result_json === 'object' ? r.result_json : null;
        if (res && (res.runId === cleanId || res.jobId === cleanId)) return true;
        return false;
      });

      if (found) {
        const resultData = typeof found.result_json === 'object' ? found.result_json : (found.result_raw ? JSON.parse(found.result_raw) : {});
        const htmlContent = buildReportHtml({
          results: resultData.steps || [],
          axeViolations: resultData.axeViolations || [],
          targetUrl: resultData.targetUrl || '',
          jobName: resultData.jobName || found.title || 'Relatório de Teste',
          plannedSteps: resultData.generatedStepsCode || resultData.plannedSteps || [],
        });

        const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        return new NextResponse(htmlContent, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `inline; filename="${filename}"`,
          },
        });
      }
    } catch (e) {
      console.warn('[Reports Route] Falha ao recuperar relatório do banco:', e);
    }

    return new NextResponse(
      `Relatório não encontrado. O arquivo "${filename}" não existe no diretório public/reports.`,
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
