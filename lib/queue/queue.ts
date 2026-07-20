// -------------------------------------------------------
// Instância compartilhada da Queue BullMQ
// -------------------------------------------------------
// IMPORTANTE: Este arquivo só deve ser importado no lado do servidor (Node.js)
// Nunca importe diretamente de client components.

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { AutomationJobData } from './types';

// Conexão Redis – usa REDIS_URL do .env ou fallback local
let _connection: IORedis | null = null;
let _queue: Queue<AutomationJobData> | null = null;

function getConnection(): IORedis {
  if (!_connection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    _connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return _connection;
}

export function getQueue(): Queue<AutomationJobData> {
  if (!_queue) {
    _queue = new Queue<AutomationJobData>('automation-jobs', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: { age: 3600 * 24 },  // Remove jobs completos após 24h
        removeOnFail: { age: 3600 * 24 * 7 },  // Mantém falhas por 7 dias para debug
      },
    });
  }
  return _queue;
}

export { getConnection };
