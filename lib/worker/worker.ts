// -------------------------------------------------------
// Worker BullMQ — Processo separado do Next.js
// Rodar com: node -r ts-node/register lib/worker/worker.ts
// No Render: definir como "Background Worker" service
// -------------------------------------------------------

import { Worker, type Job } from 'bullmq';
import { getConnection } from '../queue/queue';
import type { AutomationJobData } from '../queue/types';
import { executeAutomation } from './executor';

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

worker.on('completed', (job) => {
  console.log(`[Worker] 🎉 Job ${job.id} finalizado com sucesso.`);
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
