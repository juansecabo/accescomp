// Builder que imita el subconjunto de supabase-js que usa esta app
// (.from().select().eq().order().limit().single(), insert/update/delete
// y storage). Ejecuta las consultas a través del "ejecutor" recibido:
// - en el navegador: fetch a /api/db
// - en el servidor (rutas API / PDF): el motor SQLite directamente

import type { ConsultaLocal } from './engine';

type Resultado = { data: any; error: { message: string } | null };
export type Ejecutor = (q: ConsultaLocal) => Promise<Resultado>;

class ConsultaBuilder implements PromiseLike<Resultado> {
  private q: ConsultaLocal;
  private ejecutor: Ejecutor;

  constructor(ejecutor: Ejecutor, table: string) {
    this.ejecutor = ejecutor;
    this.q = { op: 'select', table };
  }

  select(sel: string = '*') {
    if (this.q.op === 'insert' || this.q.op === 'update') {
      this.q.returning = true;
    } else {
      this.q.op = 'select';
      this.q.select = sel;
    }
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.q.op = 'insert';
    this.q.values = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.q.op = 'update';
    this.q.values = values;
    return this;
  }

  delete() {
    this.q.op = 'delete';
    return this;
  }

  eq(col: string, val: unknown) {
    this.q.filters = [...(this.q.filters || []), { col, val }];
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.q.order = { col, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(n: number) {
    this.q.limit = n;
    return this;
  }

  single() {
    this.q.single = true;
    if (this.q.op === 'insert') this.q.returning = true;
    return this;
  }

  then<T1 = Resultado, T2 = never>(
    onfulfilled?: ((value: Resultado) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return this.ejecutor(this.q).then(onfulfilled, onrejected);
  }
}

class StorageBucketLocal {
  constructor(private bucket: string) {}

  async upload(ruta: string, archivo: Blob | File) {
    const res = await fetch(`/api/storage?ruta=${encodeURIComponent(ruta)}`, {
      method: 'POST',
      body: archivo,
    });
    if (!res.ok) {
      return { data: null, error: { message: `Error al guardar el archivo (${res.status})` } };
    }
    return { data: { path: ruta }, error: null };
  }

  getPublicUrl(ruta: string) {
    return { data: { publicUrl: `/api/media/${ruta}` } };
  }
}

export function crearClienteLocal(ejecutor: Ejecutor) {
  return {
    from(table: string) {
      return new ConsultaBuilder(ejecutor, table);
    },
    storage: {
      from(bucket: string) {
        return new StorageBucketLocal(bucket);
      },
    },
  };
}
