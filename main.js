const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'reciminsaapp',
    icon: path.join(__dirname, 'www/logo-no-white-lines.png'), // Tu logo de reciclaje
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Manejar descargas de forma nativa (PDFs, Excel, etc.)
  win.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const savePath = dialog.showSaveDialogSync(win, {
      title: 'Guardar Archivo',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      filters: [
        { name: 'Archivos PDF', extensions: ['pdf'] },
        { name: 'Archivos Excel', extensions: ['xlsx', 'xls'] },
        { name: 'Todos los archivos', extensions: ['*'] }
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