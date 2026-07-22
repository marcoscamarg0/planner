// -------------------------------------------------------
// GET /api/automation/status/[jobId]
// Retorna o status atual do job + resultado se concluído
// -------------------------------------------------------

import { NextResponse } from 'next/server';
import { getQueue } from '@/lib/queue/queue';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params;
    const queue = getQueue();
    const job = await queue.getJob(resolvedParams.jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
    }

    const state = await job.getState();
    const progress = (job.progress as number) || 0;
    const logData = await queue.getJobLogs(resolvedParams.jobId, 0, -1);
    const logs = logData.logs || [];
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    // Calcular label de estado
    const stateLabel: Record<string, string> = {
      waiting: 'Aguardando na fila...',
      active:  'Executando automação...',
      completed: 'Concluído!',
      failed: 'Falhou',
      delayed: 'Aguardando retry...',
      unknown: 'Desconhecido',
    };

    return NextResponse.json({
      jobId:     resolvedParams.jobId,
      jobName:   job.data.jobName,
      targetUrl: job.data.targetUrl,
      totalSteps: job.data.scriptSteps.length,
      status:    state,
      statusLabel: stateLabel[state] || state,
      progress,
      logs,
      // Dados do resultado (quando concluído)
      pdfUrl:           returnValue?.pdfUrl || null,
      htmlReportUrl:    returnValue?.htmlReportUrl || null,
      steps:            returnValue?.steps || null,
      axeViolationsCount: returnValue?.axeViolationsCount ?? null,
      approvedSteps:    returnValue?.approvedSteps ?? null,
      failedSteps:      returnValue?.failedSteps ?? null,
      reportMarkdown:   returnValue?.reportMarkdown || null,
      completedAt:      returnValue?.completedAt || null,
      // Em caso de falha
      error: failedReason || null,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
