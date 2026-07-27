import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Excluir relatórios (DELETE)
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs inválidos ou não fornecidos' }, { status: 400 });
    }

    const { error } = await supabase
      .from('qa_reports')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ message: 'Relatórios excluídos com sucesso', count: ids.length });
  } catch (err: any) {
    console.error('[QA Manage DELETE]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

// Editar título ou descrição do relatório (PUT)
export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { id, title, input_description } = body;

    if (!id || (!title && !input_description)) {
      return NextResponse.json({ error: 'Dados insuficientes para atualização' }, { status: 400 });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (input_description !== undefined) updates.input_description = input_description;

    const { error } = await supabase
      .from('qa_reports')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ message: 'Relatório atualizado com sucesso' });
  } catch (err: any) {
    console.error('[QA Manage PUT]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
