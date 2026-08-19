import * as fs from 'fs';
import * as path from 'path';
import { createAppwriteClient } from '@/lib/appwrite/adapter';

/**
 * Exclui automaticamente arquivos de relatórios (HTML, PDF, PNG)
 * e registros de relatórios de QA que foram gerados há mais de 3 dias.
 */
export async function cleanOldReports(maxAgeDays: number = 3): Promise<{
  deletedFiles: string[];
  deletedDbReports: number;
}> {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - maxAgeMs;
  const cutoffDate = new Date(cutoffTime).toISOString();
  const deletedFiles: string[] = [];
  let deletedDbReports = 0;

  // 1. Limpeza no disco local (public/reports)
  try {
    const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      for (const file of files) {
        // Ignora arquivos de controle como .gitkeep
        if (file.startsWith('.')) continue;

        const filePath = path.join(reportsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile() && stats.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
            deletedFiles.push(file);
          }
        } catch (fileErr) {
          console.warn(`[CleanupReports] Falha ao processar arquivo ${file}:`, fileErr);
        }
      }
    }
  } catch (dirErr) {
    console.warn('[CleanupReports] Erro ao ler pasta public/reports:', dirErr);
  }

  // 2. Limpeza de relatórios antigos no banco de dados Appwrite (qa_reports criados há mais de 3 dias)
  try {
    const supabase = createAppwriteClient();
    const { data: oldReports } = await supabase
      .from('qa_reports')
      .select('id, created_at')
      .lt('created_at', cutoffDate);

    if (oldReports && oldReports.length > 0) {
      const oldIds = oldReports.map((r: any) => r.id);
      await supabase.from('qa_reports').delete().in('id', oldIds);
      deletedDbReports = oldIds.length;
    }
  } catch (dbErr) {
    console.warn('[CleanupReports] Erro ao limpar qa_reports no banco:', dbErr);
  }

  if (deletedFiles.length > 0 || deletedDbReports > 0) {
    console.log(
      `[CleanupReports] 🧹 Limpeza concluída: ${deletedFiles.length} arquivos locais e ${deletedDbReports} relatórios do banco com mais de ${maxAgeDays} dias foram excluídos.`
    );
  }

  return { deletedFiles, deletedDbReports };
}
