import { NextResponse } from 'next/server';
import { cleanOldReports } from '@/lib/utils/cleanup-reports';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await cleanOldReports(3);
    return NextResponse.json({
      success: true,
      message: 'Limpeza automática de 3 dias executada com sucesso.',
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
