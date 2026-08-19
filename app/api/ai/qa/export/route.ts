import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Exportar relatório para Tarefas/Projetos (POST)
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { reportIds, projectId } = body;

    if (!Array.isArray(reportIds) || reportIds.length === 0 || !projectId) {
      return NextResponse.json({ error: 'IDs de relatório ou de projeto inválidos' }, { status: 400 });
    }

    // Buscar os relatórios
    const { data: reports, error: fetchErr } = await supabase
      .from('qa_reports')
      .select('*')
      .in('id', reportIds)
      .eq('user_id', user.id);

    if (fetchErr || !reports || reports.length === 0) {
      throw fetchErr || new Error('Relatórios não encontrados.');
    }

    // Criar as tarefas no projeto
    const tasksToInsert = ((reports as any[]) || []).map((report: any) => ({
      project_id: projectId,
      title: `[QA] ${report.title}`,
      description: `**Relatório de Automação QA**\n\n**Tipo:** ${report.type}\n**Descrição original:** ${report.input_description}\n**Criado em:** ${new Date(report.created_at).toLocaleString('pt-BR')}\n\n**Link para o relatório (PDF/HTML):**\n${report.result_raw ? JSON.parse(report.result_raw).htmlReportUrl || '' : ''}`,
      status: 'todo',
      priority: 'medium',
      assignee_id: user.id
    }));

    const { error: insertErr } = await supabase
      .from('tasks')
      .insert(tasksToInsert);

    if (insertErr) throw insertErr;

    return NextResponse.json({ message: 'Tarefas criadas com sucesso', count: tasksToInsert.length });
  } catch (err: any) {
    console.error('[QA Export POST]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
