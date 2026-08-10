// Proceso principal de Electron para Accescomp Gestión (app instalable).
// Arranca el servidor Next standalone en modo local (SQLite) y abre la ventana.

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const http = require('node:http');

const PUERTO = 34117;

function rutasApp() {
  if (app.isPackaged) {
    return {
      servidor: path.join(process.resourcesPath, 'standalone', 'server.js'),
      semilla: path.join(process.resourcesPath, 'seed'),
    };
  }
  // Desarrollo: usa el build standalone del propio repo
  const raiz = path.join(__dirname, '..');
  return {
    servidor: path.join(raiz, '.next', 'standalone', 'server.js'),
    semilla: path.join(raiz, 'seed'),
  };
}

function iniciarServidor() {
  const { servidor, semilla } = rutasApp();

  // La base de datos y los archivos multimedia viven en la carpeta
  // de datos del usuario (%APPDATA%/Accescomp Gestion/datos)
  process.env.ACCESCOMP_DATA_DIR = path.join(app.getPath('userData'), 'datos');
  process.env.ACCESCOMP_SEED_DIR = semilla;
  process.env.NEXT_PUBLIC_DATA_MODE = 'local';
  process.env.PORT = String(PUERTO);
  process.env.HOSTNAME = '127.0.0.1';

  require(servidor);
}

function esperarServidor(intentos = 60) {
  return new Promise((resolver, rechazar) => {
    const probar = (restantes) => {
      const req = http.get(`http://127.0.0.1:${PUERTO}/login`, (res) => {
        res.resume();
        resolver();
      });
      req.on('error', () => {
        if (restantes <= 0) return rechazar(new Error('El servidor local no respondió'));
        setTimeout(() => probar(restantes - 1), 500);
      });
    };
    probar(intentos);
  });
}

async function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1b2a',
    title: 'Accescomp Gestión',
    icon: path.join(__dirname, '..', 'public', 'pwa-512x512.png'),
  });

  // Los enlaces externos (cailico.com) se abren en el navegador del sistema
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${PUERTO}`)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await esperarServidor();
  await ventana.loadURL(`http://127.0.0.1:${PUERTO}`);
  ventana.maximize();
  ventana.show();
}

// Instancia única: si la app ya está abierta, enfocar esa ventana
// en vez de fallar por el puerto ocupado
const esInstanciaUnica = app.requestSingleInstanceLock();
if (!esInstanciaUnica) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const ventana = BrowserWindow.getAllWindows()[0];
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  app.whenReady().then(() => {
    iniciarServidor();
    crearVentana();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
