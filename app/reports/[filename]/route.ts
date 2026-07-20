import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  
  // Reports are saved to public/reports by the backend at runtime.
  // Next.js doesn't serve files added to public/ after build time, so we serve them here.
  const filePath = path.resolve(process.cwd(), 'public', 'reports', filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  
  let contentType = 'application/octet-stream';
  if (filename.endsWith('.pdf')) contentType = 'application/pdf';
  else if (filename.endsWith('.html')) contentType = 'text/html; charset=utf-8';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      // Optional: inline disposition to view in browser instead of downloading directly
      'Content-Disposition': `inline; filename="${filename}"`
    },
  });
}
