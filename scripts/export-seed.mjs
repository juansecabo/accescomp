// Exporta todos los datos de Supabase a ./seed para sembrar la app instalable.
// Uso: node scripts/export-seed.mjs
// Lee las credenciales de .env.local. La carpeta seed/ NO se sube a git
// (contiene datos personales); se regenera cada vez que se construye el instalador.

import { readFileSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env.local'), 'utf8');
const URL_BASE = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const TABLAS = [
  'configuracion',
  'clientes',
  'trabajadores',
  'tecnicos',
  'ordenes',
  'items_orden',
  'pagos',
  'archivos_orden',
];

const seedDir = join(root, 'seed');
const archivosDir = join(seedDir, 'archivos');
mkdirSync(archivosDir, { recursive: true });

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function exportarTabla(tabla) {
  const res = await fetch(`${URL_BASE}/rest/v1/${tabla}?select=*`, { headers });
  if (!res.ok) throw new Error(`${tabla}: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  writeFileSync(join(seedDir, `${tabla}.json`), JSON.stringify(data, null, 2));
  console.log(`✓ ${tabla}: ${data.length} registros`);
  return data;
}

const datos = {};
for (const tabla of TABLAS) {
  datos[tabla] = await exportarTabla(tabla);
}

// Descargar archivos multimedia por su URL pública.
// Se renombran a <id>.<ext> y la app local los servirá desde su carpeta de datos.
let descargados = 0;
let fallidos = [];
for (const archivo of datos.archivos_orden) {
  try {
    const res = await fetch(archivo.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ext = archivo.url.split('.').pop().split('?')[0].toLowerCase();
    const destino = join(archivosDir, `${archivo.id}.${ext}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(destino));
    descargados++;
  } catch (err) {
    fallidos.push({ id: archivo.id, url: archivo.url, error: String(err) });
  }
}
console.log(`✓ archivos multimedia: ${descargados} descargados`);
if (fallidos.length) {
  console.log(`✗ ${fallidos.length} archivos fallaron:`);
  for (const f of fallidos) console.log(`  - ${f.id}: ${f.error}`);
  writeFileSync(join(seedDir, 'archivos-fallidos.json'), JSON.stringify(fallidos, null, 2));
}

writeFileSync(
  join(seedDir, 'meta.json'),
  JSON.stringify({ exportado_en: new Date().toISOString(), origen: URL_BASE }, null, 2)
);
console.log('Semilla exportada en ./seed');
