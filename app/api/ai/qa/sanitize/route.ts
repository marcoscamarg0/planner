import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  
  const { data: reports, error } = await supabase
    .from('qa_reports')
    .select('id, result_json')
    .eq('type', 'smart_runner')
    .not('result_json', 'is', null);

  if (error) return NextResponse.json({ error });

  let fixed = 0;
  for (const report of reports) {
    if (!report.result_json) continue;
    let needsUpdate = false;
    let json = typeof report.result_json === 'string' ? JSON.parse(report.result_json) : report.result_json;

    if (json.finalScreenshot) {
      delete json.finalScreenshot;
      needsUpdate = true;
    }

    if (json.steps && Array.isArray(json.steps)) {
      json.steps = json.steps.map((s: any) => {
        if (s.screenshotBase64) {
          delete s.screenshotBase64;
          needsUpdate = true;
        }
        return s;
      });
    }

    if (needsUpdate) {
      await supabase
        .from('qa_reports')
        .update({ 
          result_json: json,
          result_raw: JSON.stringify(json)
        })
        .eq('id', report.id);
      fixed++;
    }
  }

  return NextResponse.json({ success: true, fixed });
}
