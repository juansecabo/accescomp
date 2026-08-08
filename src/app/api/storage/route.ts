import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// Guarda un archivo multimedia en la carpeta de datos local (modo instalable).
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== 'local') {
    return new NextResponse('Modo local deshabilitado', { status: 404 });
  }

  const { dirArchivos } = await import('@/lib/localdb/engine');
  const ruta = new URL(request.url).searchParams.get('ruta') || '';

  // Evitar salirse de la carpeta de archivos
  const destino = path.normalize(path.join(dirArchivos(), ruta));
  if (!destino.startsWith(path.normalize(dirArchivos()))) {
    return new NextResponse('Ruta inválida', { status: 400 });
  }

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const contenido = Buffer.from(await request.arrayBuffer());
  fs.writeFileSync(destino, contenido);
  return NextResponse.json({ ok: true, ruta });
}
