import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, color')
      .eq('owner_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ projects: projects || [] });
  } catch (err: any) {
    console.error('[Projects GET]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
