// Motor de datos local sobre SQLite. Solo se usa en modo local
// (app instalable). Ejecuta las consultas descritas por el builder
// (src/lib/localdb/builder.ts), imitando el subconjunto de PostgREST
// que usa esta app: select con relaciones embebidas, eq, order, limit,
// single, insert, update y delete.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ConsultaLocal {
  op: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  select?: string;
  filters?: { col: string; val: unknown }[];
  order?: { col: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  returning?: boolean;
}

const LISTA_TABLAS = [
  'configuracion',
  'clientes',
  'trabajadores',
  'tecnicos',
  'ordenes',
  'items_orden',
  'pagos',
  'archivos_orden',
];
const TABLAS_VALIDAS = new Set(LISTA_TABLAS);

// Columnas booleanas (SQLite las guarda como 0/1)
const COLUMNAS_BOOL: Record<string, string[]> = {
  trabajadores: ['activo'],
  ordenes: ['condiciones_aceptadas'],
};

// Singular de cada tabla, para inferir claves foráneas (orden_id, cliente_id...)
const SINGULAR: Record<string, string> = {
  ordenes: 'orden',
  clientes: 'cliente',
  trabajadores: 'trabajador',
  tecnicos: 'tecnico',
  items_orden: 'item',
  pagos: 'pago',
  archivos_orden: 'archivo',
  configuracion: 'configuracion',
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS configuracion (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  nombre_negocio TEXT,
  condiciones_servicio TEXT,
  proximo_numero_orden INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  tipo_documento TEXT,
  numero_documento TEXT,
  condiciones_servicio TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS trabajadores (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS tecnicos (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  email TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS ordenes (
  id TEXT PRIMARY KEY,
  numero_orden INTEGER,
  cliente_id TEXT,
  tecnico_id TEXT,
  equipo_descripcion TEXT,
  observaciones TEXT,
  motivo_visita TEXT,
  trabajo_realizar TEXT,
  estado TEXT,
  firma_cliente TEXT,
  condiciones_aceptadas INTEGER DEFAULT 0,
  condiciones_servicio TEXT,
  recibido_por_id TEXT,
  tecnico_asignado_id TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS items_orden (
  id TEXT PRIMARY KEY,
  orden_id TEXT,
  descripcion TEXT,
  precio REAL DEFAULT 0,
  cantidad REAL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY,
  orden_id TEXT,
  monto REAL,
  metodo_pago TEXT,
  fecha TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS archivos_orden (
  id TEXT PRIMARY KEY,
  orden_id TEXT,
  tipo TEXT,
  url TEXT,
  nombre TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export function dirDatos(): string {
  return process.env.ACCESCOMP_DATA_DIR || path.join(process.cwd(), 'localdata');
}

export function dirArchivos(): string {
  return path.join(dirDatos(), 'archivos');
}

let db: Database.Database | null = null;

function abrirDb(): Database.Database {
  if (db) return db;

  const dir = dirDatos();
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(dirArchivos(), { recursive: true });

  db = new Database(path.join(dir, 'accescomp.db'));
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  sembrarSiVacia(db);
  return db;
}

// Primer arranque: importar la semilla (datos exportados de Supabase)
function sembrarSiVacia(db: Database.Database) {
  const filas = db.prepare('SELECT COUNT(*) as n FROM configuracion').get() as { n: number };
  if (filas.n > 0) return;

  const seedDir = process.env.ACCESCOMP_SEED_DIR || path.join(process.cwd(), 'seed');
  if (!fs.existsSync(seedDir)) {
    // Sin semilla: crear configuración mínima para que la app funcione
    db.prepare(
      'INSERT INTO configuracion (id, password_hash, nombre_negocio, proximo_numero_orden) VALUES (1, ?, ?, 1)'
    ).run('accescomp2024', 'Accescomp');
    return;
  }

  const leer = (tabla: string): Record<string, unknown>[] => {
    const ruta = path.join(seedDir, `${tabla}.json`);
    return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : [];
  };

  const importar = db.transaction(() => {
    for (const tabla of LISTA_TABLAS) {
      const registros = leer(tabla);
      if (registros.length === 0) continue;
      const columnas = obtenerColumnas(db!, tabla);
      const insert = db!.prepare(
        `INSERT INTO ${tabla} (${columnas.join(',')}) VALUES (${columnas.map((c) => `@${c}`).join(',')})`
      );
      for (const registro of registros) {
        const fila: Record<string, unknown> = {};
        for (const col of columnas) {
          let valor = registro[col] ?? null;
          if (typeof valor === 'boolean') valor = valor ? 1 : 0;
          // Los archivos multimedia pasan a servirse localmente
          if (tabla === 'archivos_orden' && col === 'url' && typeof valor === 'string') {
            const ext = valor.split('.').pop()?.split('?')[0]?.toLowerCase() || 'bin';
            valor = `/api/media/${registro.id}.${ext}`;
          }
          fila[col] = valor;
        }
        insert.run(fila);
      }
    }
  });
  importar();

  // Copiar los archivos multimedia de la semilla a la carpeta de datos
  const seedArchivos = path.join(seedDir, 'archivos');
  if (fs.existsSync(seedArchivos)) {
    for (const nombre of fs.readdirSync(seedArchivos)) {
      const destino = path.join(dirArchivos(), nombre);
      if (!fs.existsSync(destino)) {
        fs.copyFileSync(path.join(seedArchivos, nombre), destino);
      }
    }
  }
}

function obtenerColumnas(db: Database.Database, tabla: string): string[] {
  const info = db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[];
  return info.map((c) => c.name);
}

function validarIdentificador(nombre: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(nombre)) {
    throw new Error(`Identificador inválido: ${nombre}`);
  }
}

function convertirBooleanos(tabla: string, fila: Record<string, unknown>) {
  for (const col of COLUMNAS_BOOL[tabla] || []) {
    if (col in fila && fila[col] !== null) fila[col] = !!fila[col];
  }
  return fila;
}

// ---- Parser del select con relaciones embebidas ----

interface Relacion {
  alias: string;
  tabla: string;
  fk: string | null;
  columnas: string;
  esCount: boolean;
}

function separarNivelSuperior(sel: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let actual = '';
  for (const ch of sel.split('')) {
    if (ch === '(') nivel++;
    if (ch === ')') nivel--;
    if (ch === ',' && nivel === 0) {
      partes.push(actual.trim());
      actual = '';
    } else {
      actual += ch;
    }
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}

function parsearSelect(sel: string): { columnas: string[]; relaciones: Relacion[] } {
  const columnas: string[] = [];
  const relaciones: Relacion[] = [];

  for (const parte of separarNivelSuperior(sel || '*')) {
    const m = parte.match(/^(?:([a-z_]+):)?([a-z_]+)(?:!([a-z_]+))?\(([^)]*)\)$/i);
    if (m) {
      const [, alias, tabla, fk, interior] = m;
      relaciones.push({
        alias: alias || tabla,
        tabla,
        fk: fk || null,
        columnas: interior.trim() || '*',
        esCount: interior.trim() === 'count',
      });
    } else {
      columnas.push(parte);
    }
  }
  return { columnas: columnas.length ? columnas : ['*'], relaciones };
}

function resolverRelacion(
  db: Database.Database,
  origen: string,
  rel: Relacion,
  fila: Record<string, unknown>
): unknown {
  validarIdentificador(rel.tabla);
  if (!TABLAS_VALIDAS.has(rel.tabla)) throw new Error(`Tabla desconocida: ${rel.tabla}`);

  const colsOrigen = obtenerColumnas(db, origen);
  const colsDestino = obtenerColumnas(db, rel.tabla);

  // Determinar dirección de la relación
  let fkEnOrigen: string | null = null;
  let fkEnDestino: string | null = null;

  if (rel.fk) {
    if (colsOrigen.includes(rel.fk)) fkEnOrigen = rel.fk;
    else if (colsDestino.includes(rel.fk)) fkEnDestino = rel.fk;
  } else {
    const candidatoOrigen = `${rel.alias}_id`;
    const candidatoDestino = `${SINGULAR[origen]}_id`;
    if (colsOrigen.includes(candidatoOrigen)) fkEnOrigen = candidatoOrigen;
    else if (colsDestino.includes(candidatoDestino)) fkEnDestino = candidatoDestino;
  }

  if (rel.esCount && fkEnDestino) {
    const r = db
      .prepare(`SELECT COUNT(*) as count FROM ${rel.tabla} WHERE ${fkEnDestino} = ?`)
      .get(fila.id) as { count: number };
    return [{ count: r.count }];
  }

  const cols =
    rel.columnas === '*'
      ? '*'
      : rel.columnas
          .split(',')
          .map((c) => c.trim())
          .filter((c) => /^[a-z_][a-z0-9_]*$/i.test(c))
          .join(',');

  if (fkEnOrigen) {
    // many-to-one: objeto (o null)
    if (fila[fkEnOrigen] == null) return null;
    const r = db
      .prepare(`SELECT ${cols} FROM ${rel.tabla} WHERE id = ?`)
      .get(fila[fkEnOrigen]) as Record<string, unknown> | undefined;
    return r ? convertirBooleanos(rel.tabla, r) : null;
  }

  if (fkEnDestino) {
    // one-to-many: array
    const rs = db
      .prepare(`SELECT ${cols} FROM ${rel.tabla} WHERE ${fkEnDestino} = ?`)
      .all(fila.id) as Record<string, unknown>[];
    return rs.map((r) => convertirBooleanos(rel.tabla, r));
  }

  throw new Error(`No se pudo resolver la relación ${rel.alias}:${rel.tabla} desde ${origen}`);
}

// ---- Ejecutor principal ----

export function ejecutarConsulta(q: ConsultaLocal): { data: unknown; error: { message: string } | null } {
  try {
    const conexion = abrirDb();
    validarIdentificador(q.table);
    if (!TABLAS_VALIDAS.has(q.table)) throw new Error(`Tabla desconocida: ${q.table}`);

    for (const f of q.filters || []) validarIdentificador(f.col);
    if (q.order) validarIdentificador(q.order.col);

    const where = (q.filters || [])
      .map((f) => `${f.col} = ?`)
      .join(' AND ');
    const whereSql = where ? ` WHERE ${where}` : '';
    const valoresWhere = (q.filters || []).map((f) =>
      typeof f.val === 'boolean' ? (f.val ? 1 : 0) : f.val
    );

    if (q.op === 'select') {
      const { columnas, relaciones } = parsearSelect(q.select || '*');
      const colsSql = columnas.includes('*') ? '*' : columnas.map((c) => (validarIdentificador(c), c)).join(',');
      let sql = `SELECT ${colsSql} FROM ${q.table}${whereSql}`;
      if (q.order) sql += ` ORDER BY ${q.order.col} ${q.order.ascending ? 'ASC' : 'DESC'}`;
      if (q.limit) sql += ` LIMIT ${Math.floor(q.limit)}`;

      let filas = conexion.prepare(sql).all(...valoresWhere) as Record<string, unknown>[];
      filas = filas.map((f) => convertirBooleanos(q.table, f));

      for (const fila of filas) {
        for (const rel of relaciones) {
          fila[rel.alias] = resolverRelacion(conexion, q.table, rel, fila);
        }
      }

      if (q.single) {
        if (filas.length === 0) {
          return { data: null, error: { message: 'No rows found' } };
        }
        return { data: filas[0], error: null };
      }
      return { data: filas, error: null };
    }

    if (q.op === 'insert') {
      const registros = Array.isArray(q.values) ? q.values : [q.values || {}];
      const columnas = obtenerColumnas(conexion, q.table);
      const insertados: Record<string, unknown>[] = [];

      const tx = conexion.transaction(() => {
        for (const registro of registros) {
          const fila: Record<string, unknown> = { ...registro };
          if (columnas.includes('id') && fila.id == null && q.table !== 'configuracion') {
            fila.id = randomUUID();
          }
          const cols = Object.keys(fila).filter((c) => columnas.includes(c));
          for (const c of cols) {
            if (typeof fila[c] === 'boolean') fila[c] = fila[c] ? 1 : 0;
          }
          conexion
            .prepare(`INSERT INTO ${q.table} (${cols.join(',')}) VALUES (${cols.map((c) => `@${c}`).join(',')})`)
            .run(Object.fromEntries(cols.map((c) => [c, fila[c]])));
          const insertado = conexion
            .prepare(`SELECT * FROM ${q.table} WHERE id = ?`)
            .get(fila.id) as Record<string, unknown>;
          insertados.push(convertirBooleanos(q.table, insertado));
        }
      });
      tx();

      if (q.returning) {
        return { data: q.single ? insertados[0] : insertados, error: null };
      }
      return { data: null, error: null };
    }

    if (q.op === 'update') {
      const valores: Record<string, unknown> = { ...(q.values as Record<string, unknown>) };
      const cols = Object.keys(valores);
      for (const c of cols) {
        validarIdentificador(c);
        if (typeof valores[c] === 'boolean') valores[c] = valores[c] ? 1 : 0;
      }
      const setSql = cols.map((c) => `${c} = @${c}`).join(', ');
      const whereNombrado = (q.filters || []).map((f, i) => `${f.col} = @__w${i}`).join(' AND ');
      const paramsWhere = Object.fromEntries(valoresWhere.map((v, i) => [`__w${i}`, v]));
      conexion
        .prepare(`UPDATE ${q.table} SET ${setSql}${whereNombrado ? ` WHERE ${whereNombrado}` : ''}`)
        .run({ ...valores, ...paramsWhere });
      return { data: null, error: null };
    }

    if (q.op === 'delete') {
      conexion.prepare(`DELETE FROM ${q.table}${whereSql}`).run(...valoresWhere);
      return { data: null, error: null };
    }

    throw new Error(`Operación desconocida: ${q.op}`);
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}
