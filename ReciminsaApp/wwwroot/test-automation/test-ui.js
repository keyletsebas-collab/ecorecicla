const puppeteer = require('puppeteer');
const express = require('express');

const app = express();
app.use(express.static('C:/Users/keyle/OneDrive/Desktop/Reciminsa app'));

app.listen(3000, async () => {
    console.log('Servidor web iniciado. Lanzando navegador...');
    
    // Launch visibly
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        args: ['--start-maximized', '--window-size=1920,1080']
    });
    
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/index.html');
    
    console.log('Esperando formulario de login...');
    await new Promise(r => setTimeout(r, 2000)); // Let the user see it load
    
    await page.waitForSelector('#login-email', {visible: true});
    
    // Type credentials slowly so the user can watch
    await page.type('#login-email', 'keyletsebas@gmail.com', {delay: 100});
    await page.type('#login-password', 'keybas121213', {delay: 100});
    
    console.log('Iniciando sesión...');
    await page.keyboard.press('Enter');
    
    // Wait for the app screen to appear
    await page.waitForSelector('#app-screen:not(.hidden)', {visible: true, timeout: 15000});
    await new Promise(r => setTimeout(r, 3000)); // Pause so they can read the dashboard
    
    console.log('Navegando por las pestañas...');
    
    // Click through sidebar items
    const tabs = ['Historial', 'Bitácoras de Recogida', 'Facturación', 'Códigos de Materiales', 'Clientes', 'Ingresos', 'Egresos', 'Ajustes'];
    
    for (const tab of tabs) {
        console.log(`Probando apartado: ${tab}`);
        try {
            // Find the span containing the text, then click its parent .nav-item
            const elements = await page.$x(`//span[contains(text(), '${tab}')]/..`);
            if (elements.length > 0) {
                await elements[0].click();
                // Pause to let the user see the content
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (err) {
            console.log(`No se pudo clickear: ${tab}`);
        }
    }
    
    console.log('Prueba visual finalizada con éxito. Dejando el navegador abierto.');
});
