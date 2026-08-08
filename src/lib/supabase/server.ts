import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { crearClienteLocal } from '@/lib/localdb/builder';

// Modo local (app instalable): consulta el motor SQLite directamente.
const MODO_LOCAL = process.env.NEXT_PUBLIC_DATA_MODE === 'local';

export async function createClient(): Promise<SupabaseClient> {
  if (MODO_LOCAL) {
    const { ejecutarConsulta } = await import('@/lib/localdb/engine');
    // Implementa el subconjunto del API de supabase-js que usa esta app
    return crearClienteLocal(async (q) => ejecutarConsulta(q)) as unknown as SupabaseClient;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
