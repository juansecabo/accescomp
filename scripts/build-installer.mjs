// Construye el instalador de Windows de Accescomp Gestión.
// Pasos:
//   1. Exporta la semilla de datos actual desde Supabase (si hay conexión)
//   2. Compila Next en modo local (standalone)
//   3. Poda del standalone las carpetas que el tracing arrastra de más
//   4. Empaqueta con electron-builder (NSIS)
//
// better-sqlite3 v13 trae prebuilds N-API por plataforma, así que el mismo
// binario funciona en Node y en Electron sin recompilar.
//
// Uso: npm run dist:win
//      npm run dist:win -- --sin-semilla   (usa la carpeta seed existente)

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const correr = (cmd, env = {}) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...env } });
};

const sinSemilla = process.argv.includes('--sin-semilla');

// 1. Semilla fresca
if (!sinSemilla) {
  try {
    correr('node scripts/export-seed.mjs');
  } catch {
    if (!existsSync(join(raiz, 'seed'))) throw new Error('No hay semilla y la exportación falló');
    console.log('⚠ No se pudo exportar semilla fresca; se usa la existente en ./seed');
  }
}

// 2. Next standalone en modo local
correr('npx next build', { NEXT_PUBLIC_DATA_MODE: 'local' });

// 3. Podar carpetas arrastradas por el file tracing (la semilla real
//    se empaca aparte en resources/seed; localdata es la base de pruebas)
for (const carpeta of ['localdata', 'seed', 'referencias']) {
  rmSync(join(raiz, '.next', 'standalone', carpeta), { recursive: true, force: true });
}

// 4. Instalador
correr('npx electron-builder --win');

console.log('\n✓ Instalador generado en dist-electron/');
