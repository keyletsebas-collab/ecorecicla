const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'www/icon-512.png'), // Tu logo de reciclaje
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('www/index.html'); // Abre tu interfaz de Reciminsa
  win.setMenu(null); // Quita los menús de navegador para que parezca una app nativa
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});