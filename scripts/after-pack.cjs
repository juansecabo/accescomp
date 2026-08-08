// Hook afterPack de electron-builder.
// Copia el servidor Next standalone completo (incluye node_modules y .next,
// que electron-builder excluye por defecto en extraResources) y la semilla.

const fs = require('node:fs');
const path = require('node:path');

exports.default = async function (context) {
  const recursos = path.join(context.appOutDir, 'resources');
  const raiz = context.packager.projectDir;

  const copiar = (desde, hasta) => {
    fs.cpSync(path.join(raiz, desde), path.join(recursos, hasta), { recursive: true });
    console.log(`  afterPack: ${desde} → resources/${hasta}`);
  };

  copiar('.next/standalone', 'standalone');
  copiar('.next/static', 'standalone/.next/static');
  copiar('public', 'standalone/public');
  copiar('seed', 'seed');
};
