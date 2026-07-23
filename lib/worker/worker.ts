// -------------------------------------------------------
// Worker BullMQ — Processo separado do Next.js
// Rodar com: node -r ts-node/register lib/worker/worker.ts
// No Render: definir como "Background Worker" service
// -------------------------------------------------------

import { Worker, type Job } from 'bullmq';
import { getConnection } from '../queue/queue';
import type { AutomationJobData } from '../queue/types';
import { executeAutomation } from './executor';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('[Worker] 🚀 Iniciando BullMQ Worker de Automação...');
console.log('[Worker] Redis URL:', process.env.REDIS_URL ? '✅ Configurado' : '⚠️ Usando localhost');

const worker = new Worker<AutomationJobData>(
  'automation-jobs',
  async (job: Job<AutomationJobData>) => {
    console.log(`\n[Worker] ▶ Job ${job.id} — "${job.data.jobName}" iniciado`);
    console.log(`[Worker]   URL: ${job.data.targetUrl}`);
    console.log(`[Worker]   Passos: ${job.data.scriptSteps.length}`);

    const result = await executeAutomation(job);

    console.log(`[Worker] ✅ Job ${job.id} concluído`);
    console.log(`[Worker]   PDF: ${result.pdfUrl || 'não gerado'}`);
    console.log(`[Worker]   Aprovados: ${result.approvedSteps}/${result.totalSteps}`);

    return result;
  },
  {
    connection: getConnection(),
    concurrency: 1,  // Um job por vez — Playwright é pesado
    lockDuration: 600_000, // 10 minutos de lock por job
  }
);

worker.on('progress', (job, progress) => {
  console.log(`[Worker] ⏳ Job ${job.id} — ${progress}%`);
});

worker.on('completed', async (job) => {
  console.log(`[Worker] 🎉 Job ${job.id} finalizado com sucesso.`);
  if (job.data.userId && job.returnvalue) {
    try {
      const resultJsonData = {
        success: true,
        runId: job.id,
        jobName: job.data.jobName,
        targetUrl: job.data.targetUrl,
        totalSteps: job.returnvalue.totalSteps,
        approvedSteps: job.returnvalue.approvedSteps,
        failedSteps: job.returnvalue.failedSteps,
        axeViolationsCount: job.returnvalue.axeViolationsCount,
        steps: job.returnvalue.steps,
        generatedStepsCode: job.data.scriptSteps?.map((s: any) => s.label) || [],
        pdfUrl: job.returnvalue.pdfUrl,
        htmlReportUrl: job.returnvalue.htmlReportUrl,
      };

      await supabase.from('qa_reports').insert({
        user_id: job.data.userId,
        type: 'automation_runner',
        title: `Automação: ${job.data.jobName}`,
        input_description: `Fluxo executado via worker em ${job.data.targetUrl}`,
        framework: 'playwright',
        model_used: 'Playwright Worker',
        result_raw: JSON.stringify(resultJsonData),
        result_json: resultJsonData,
      });
      console.log(`[Worker] Histórico salvo no Supabase para o user ${job.data.userId}`);
    } catch (err) {
      console.error('[Worker] Erro ao salvar no Supabase:', err);
    }
  }
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job?.id} FALHOU:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Erro interno:', err);
});

// Graceful shutdown
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal: string) {
  console.log(`\n[Worker] Recebido ${signal}. Aguardando job atual terminar...`);
  await worker.close();
  console.log('[Worker] Encerrado.');
  process.exit(0);
}
