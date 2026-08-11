import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Determina o Content-Type pelo nome do arquivo
  let contentType = 'application/octet-stream';
  if (filename.endsWith('.pdf')) contentType = 'application/pdf';
  else if (filename.endsWith('.html')) contentType = 'text/html; charset=utf-8';

  // --- Tenta primeiro no Supabase Storage ---
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = supabase.storage.from('reports').getPublicUrl(filename);
      
      if (data?.publicUrl) {
        // Verifica se o arquivo existe no bucket fazendo um HEAD na URL pública
        const check = await fetch(data.publicUrl, { method: 'HEAD' }).catch(() => null);
        if (check && check.ok) {
          // Redireciona direto para a URL pública da nuvem
          return NextResponse.redirect(data.publicUrl);
        }
      }
    }
  } catch (e) {
    // Falha silenciosa — tenta o disco local abaixo
    console.warn('[Reports Route] Supabase check falhou:', e);
  }

  // --- Fallback: disco local ---
  const filePath = path.resolve(process.cwd(), 'public', 'reports', filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse(
      `Relatório não encontrado. O arquivo "${filename}" não existe no disco local nem no Supabase Storage.\n\nVerifique se o bucket "reports" foi criado como público no seu painel do Supabase.`,
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
