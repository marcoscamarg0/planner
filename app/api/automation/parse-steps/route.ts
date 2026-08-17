import { NextResponse } from 'next/server';
import { generateStepsFromDescription } from '../smart-run/route';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetUrl, flowDescription, model = 'auto-free', contextImages = [] } = body;

    if (!targetUrl || !flowDescription) {
      return NextResponse.json({ error: 'targetUrl e flowDescription são obrigatórios' }, { status: 400 });
    }

    const steps = await generateStepsFromDescription(targetUrl, flowDescription, model, contextImages);

    return NextResponse.json({ steps });
  } catch (err: any) {
    console.error('[ParseSteps] Erro ao extrair passos:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
