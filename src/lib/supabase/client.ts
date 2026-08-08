import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearClienteLocal } from '@/lib/localdb/builder';
import type { ConsultaLocal } from '@/lib/localdb/engine';

// Modo local (app instalable): los datos viven en SQLite dentro del equipo
// y se consultan vía /api/db. Modo normal (web): Supabase.
const MODO_LOCAL = process.env.NEXT_PUBLIC_DATA_MODE === 'local';

async function ejecutorFetch(q: ConsultaLocal) {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    if (!res.ok) {
      return { data: null, error: { message: `Error de datos (${res.status})` } };
    }
    return await res.json();
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export function createClient(): SupabaseClient {
  if (MODO_LOCAL) {
    // Implementa el subconjunto del API de supabase-js que usa esta app
    return crearClienteLocal(ejecutorFetch) as unknown as SupabaseClient;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
