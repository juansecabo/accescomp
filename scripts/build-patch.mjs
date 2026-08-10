// Genera un PARCHE liviano para instalaciones existentes de Accescomp Gestión.
// A diferencia del Setup completo (~85 MB, trae el motor Electron entero),
// el parche solo contiene el código de la aplicación que cambia entre
// versiones (app.asar + standalone/.next + server.js).
//
// Al ejecutarlo (doble click): cierra la app si está abierta, reemplaza los
// archivos en la instalación y vuelve a abrir la app. Sin asistente.
//
// Requiere haber corrido antes `npm run dist:win` (usa dist-electron/win-unpacked).
// Si un cambio futuro toca dependencias (package.json), hay que distribuir
// el Setup completo, no el parche.
//
// Uso: npm run parche:win

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(join(raiz, 'package.json'), 'utf8')).version;
const recursos = join(raiz, 'dist-electron', 'win-unpacked', 'resources');

if (!fs.existsSync(join(recursos, 'app.asar'))) {
  throw new Error('No existe dist-electron/win-unpacked. Corre primero: npm run dist:win');
}

// 1. Preparar la carga del parche (solo lo que cambia entre versiones)
const staging = join(raiz, 'dist-electron', 'parche-staging');
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(join(staging, 'standalone'), { recursive: true });

fs.cpSync(join(recursos, 'app.asar'), join(staging, 'app.asar'));
fs.cpSync(join(recursos, 'standalone', '.next'), join(staging, 'standalone', '.next'), { recursive: true });
fs.cpSync(join(recursos, 'standalone', 'server.js'), join(staging, 'standalone', 'server.js'));

// 2. Script NSIS del parche
const salida = `Accescomp Gestion Parche ${version}.exe`;
const nsi = `
Unicode true
Name "Parche Accescomp Gestión ${version}"
OutFile "${join(raiz, 'dist-electron', salida).replace(/\\/g, '\\\\')}"
RequestExecutionLevel user
SilentInstall silent
SetCompressor /SOLID lzma

!define DIR_APP "$LOCALAPPDATA\\Programs\\Accescomp Gestion"

Section
  ; Verificar que la app esté instalada
  IfFileExists "\${DIR_APP}\\Accescomp Gestion.exe" instalada 0
    MessageBox MB_ICONSTOP "No se encontró Accescomp Gestión instalado en este equipo.$\\r$\\nEste parche solo actualiza una instalación existente; usa el instalador completo."
    Abort
  instalada:

  ; Cerrar la app si está abierta (el parche la reabre al final)
  nsExec::Exec 'taskkill /F /IM "Accescomp Gestion.exe"'
  Sleep 1500

  ; Reemplazar el código de la aplicación
  SetOutPath "\${DIR_APP}\\resources"
  File /r "${staging.replace(/\\/g, '\\\\')}\\*.*"

  ; Reabrir la app ya actualizada
  Exec '"\${DIR_APP}\\Accescomp Gestion.exe"'
SectionEnd
`;

const nsiPath = join(staging, 'parche.nsi');
fs.writeFileSync(nsiPath, nsi);

// 3. Compilar con el makensis que electron-builder ya descargó
const cacheNsis = join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'nsis-3.0.4.1');
const carpetas = fs.readdirSync(cacheNsis);
const makensis = join(cacheNsis, carpetas[0], 'Bin', 'makensis.exe');
if (!fs.existsSync(makensis)) throw new Error(`No se encontró makensis en ${cacheNsis}`);

execSync(`"${makensis}" "${nsiPath}"`, { stdio: 'inherit' });
fs.rmSync(staging, { recursive: true, force: true });

const bytes = fs.statSync(join(raiz, 'dist-electron', salida)).size;
console.log(`\n✓ Parche generado: dist-electron/${salida} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
