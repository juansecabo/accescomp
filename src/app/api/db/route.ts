import { NextResponse } from 'next/server';
import { ejecutarConsulta, type ConsultaLocal } from '@/lib/localdb/engine';

export const dynamic = 'force-dynamic';

// Puente de datos para el modo local (app instalable).
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== 'local') {
    return NextResponse.json({ data: null, error: { message: 'Modo local deshabilitado' } }, { status: 404 });
  }
  const consulta = (await request.json()) as ConsultaLocal;
  return NextResponse.json(ejecutarConsulta(consulta));
}
