const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

function getDesktopHardwareId() {
  try {
    let raw = '';
    const linuxPaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) {
        raw = fs.readFileSync(p, 'utf8').trim();
        if (raw) break;
      }
    }
    if (!raw) {
      const cpus = os.cpus() || [];
      const cpuModel = cpus[0] ? cpus[0].model : 'cpu';
      const nets = os.networkInterfaces() || {};
      let mac = '';
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
            mac = net.mac;
            break;
          }
        }
        if (mac) break;
      }
      raw = `${os.hostname()}|${os.platform()}|${os.arch()}|${cpuModel}|${mac}`;
    }
    const hex = crypto.createHash('sha256').update(raw.toLowerCase()).digest('hex').toUpperCase();
    return `PC-${hex.substring(0, 8)}-${hex.substring(8, 16)}`;
  } catch (e) {
    return 'PC-DESKTOP-LOCAL';
  }
}

function createWindow() {
  const desktopDeviceId = getDesktopHardwareId();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'reciminsaapp',
    icon: path.join(__dirname, 'www/logo-no-white-lines.png'), // Tu logo de reciclaje
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const wwwRootUrl = pathToFileURL(path.join(__dirname, 'www') + path.sep).href;
  const openSafeExternal = (targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') {
        shell.openExternal(parsed.toString());
      }
    } catch (_) {}
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    openSafeExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, navUrl) => {
    if (navUrl.startsWith(wwwRootUrl)) {
      return;
    }
    event.preventDefault();
    openSafeExternal(navUrl);
  });

  // Inyectar el identificador único de la PC cada vez que se abre o recarga la ventana
  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(
      `window.__NATIVE_DEVICE_ID__ = ${JSON.stringify(desktopDeviceId)}; window.__NATIVE_PLATFORM__ = 'ELECTRON_PC'; if (typeof refreshDeviceUUID === 'function') { refreshDeviceUUID(); }`
    ).catch(() => {});
  });

  // Manejar descargas de forma nativa (PDFs, Excel, etc.) con lista blanca segura
  const ALLOWED_DOWNLOAD_EXTS = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.txt', '.json', '.png', '.jpg', '.jpeg']);
  win.webContents.session.on('will-download', (event, item, webContents) => {
    const rawName = path.basename(item.getFilename() || 'archivo.pdf');
    const ext = path.extname(rawName).toLowerCase();
    if (!ALLOWED_DOWNLOAD_EXTS.has(ext)) {
      event.preventDefault();
      dialog.showErrorBox('Descarga bloqueada por seguridad', `El tipo de archivo "${ext || 'desconocido'}" no está permitido.`);
      return;
    }

    const savePath = dialog.showSaveDialogSync(win, {
      title: 'Guardar Archivo',
      defaultPath: path.join(app.getPath('downloads'), rawName),
      filters: [
        { name: 'Archivos PDF', extensions: ['pdf'] },
        { name: 'Archivos Excel', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'Documentos e Imágenes', extensions: ['txt', 'json', 'png', 'jpg', 'jpeg'] }
      ]
    });

    if (savePath) {
      item.setSavePath(savePath);
    } else {
      event.preventDefault(); // Cancelar descarga si el usuario cierra el diálogo
    }
  });

  win.loadFile('www/index.html'); // Abre tu interfaz de Reciminsa
  win.setMenu(null); // Quita los menús de navegador para que parezca una app nativa
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});