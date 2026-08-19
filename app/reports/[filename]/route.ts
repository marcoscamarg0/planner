import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Determina o Content-Type pelo nome do arquivo
  let contentType = 'application/octet-stream';
  if (filename.endsWith('.pdf')) contentType = 'application/pdf';
  else if (filename.endsWith('.html')) contentType = 'text/html; charset=utf-8';

  // --- Serve arquivo do disco local (public/reports) ---
  const filePath = path.resolve(process.cwd(), 'public', 'reports', filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse(
      `Relatório não encontrado. O arquivo "${filename}" não existe no diretório public/reports.`,
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
