import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

// Sirve los archivos multimedia guardados localmente (modo instalable).
export async function GET(
  _request: Request,
  { params }: { params: { ruta: string[] } }
) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== 'local') {
    return new NextResponse('Modo local deshabilitado', { status: 404 });
  }

  const { dirArchivos } = await import('@/lib/localdb/engine');
  const archivo = path.normalize(path.join(dirArchivos(), ...params.ruta));
  if (!archivo.startsWith(path.normalize(dirArchivos())) || !fs.existsSync(archivo)) {
    return new NextResponse('No encontrado', { status: 404 });
  }

  const ext = archivo.split('.').pop()?.toLowerCase() || '';
  const contenido = fs.readFileSync(archivo);
  return new NextResponse(contenido, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  });
}
