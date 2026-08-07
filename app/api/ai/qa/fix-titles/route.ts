import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  
  const { data: reports, error } = await supabase
    .from('qa_reports')
    .select('id, title, input_description')
    .like('title', '%...%');

  if (error) return NextResponse.json({ error });

  let fixed = 0;
  for (const report of reports) {
    if (!report.input_description) continue;
    
    // Extract the first line or first 150 chars from input_description
    let fullTitle = report.input_description.split('\n')[0].trim();
    if (fullTitle.length > 200) {
       fullTitle = fullTitle.slice(0, 200) + '...';
    }

    // Attempt to retain the prefix (like "Relatório — ", "Casos de Teste — ", etc.)
    let prefixMatch = report.title.match(/^(.*? — )/);
    let prefix = prefixMatch ? prefixMatch[1] : '';

    let newTitle = prefix + fullTitle;

    await supabase
      .from('qa_reports')
      .update({ title: newTitle })
      .eq('id', report.id);
    fixed++;
  }

  return NextResponse.json({ success: true, fixed });
}
