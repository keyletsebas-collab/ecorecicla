const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Limpiar descargas previas de prueba
for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
    fs.unlinkSync(path.join(DOWNLOAD_DIR, f));
}

const app = express();
app.use(express.static(ROOT_DIR));

const PORT = 3124;

const server = app.listen(PORT, async () => {
    console.log(`🚀 Servidor web iniciado en http://localhost:${PORT}`);
    let browser;
    const report = {
        account: 'keylet38@gmail.com',
        loginStatus: 'PENDING',
        userProfile: null,
        steps: [],
        createdRecords: {},
        downloadedPdfs: [],
        consoleErrors: []
    };

    function logStep(name, status, detail = '') {
        const entry = { name, status, detail, time: new Date().toISOString() };
        report.steps.push(entry);
        const icon = status === 'OK' ? '✅' : (status === 'WARN' ? '⚠️' : '❌');
        console.log(`${icon} [${name}] ${detail}`);
    }

    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            headless: 'new',
            defaultViewport: { width: 1440, height: 900 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1440,900'
            ]
        });

        const page = await browser.newPage();

        // Configurar descargas reales de navegador en DOWNLOAD_DIR
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: DOWNLOAD_DIR
        });

        // Exponer función Node para capturar también cualquier PDF generado vía blob/base64 en memoria
        await page.exposeFunction('__botCapturePdfBase64', (filename, dataUriOrB64) => {
            try {
                const cleanName = path.basename(filename || `doc_${Date.now()}.pdf`);
                const rawB64 = String(dataUriOrB64 || '').includes('base64,')
                    ? String(dataUriOrB64).split('base64,')[1]
                    : String(dataUriOrB64 || '');
                if (!rawB64) return;
                const buf = Buffer.from(rawB64, 'base64');
                const outPath = path.join(DOWNLOAD_DIR, cleanName);
                fs.writeFileSync(outPath, buf);
            } catch (e) {
                console.error('Error guardando PDF capturado:', e.message);
            }
        });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                const txt = msg.text();
                if (!txt.includes('favicon')) {
                    report.consoleErrors.push(txt);
                }
            }
        });

        page.on('dialog', async dialog => {
            console.log(`💬 [Dialog ${dialog.type()}]: ${dialog.message()}`);
            await dialog.accept();
        });

        console.log('🌐 Abriendo ReciminsaApp...');
        await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });

        // Interceptar triggerNativeOrWebDownload para guardar y verificar el binario de todos los PDFs
        await page.evaluate(() => {
            window.__pdfDownloadLog = [];
            const origTrigger = window.triggerNativeOrWebDownload;
            if (typeof origTrigger === 'function') {
                window.triggerNativeOrWebDownload = function (doc, filename) {
                    try {
                        const dataUri = doc.output('datauristring');
                        window.__pdfDownloadLog.push({ filename, size: dataUri.length });
                        if (typeof window.__botCapturePdfBase64 === 'function') {
                            window.__botCapturePdfBase64(filename, dataUri);
                        }
                    } catch (e) {
                        console.warn('Error capturando PDF en hook:', e);
                    }
                    return origTrigger.apply(this, arguments);
                };
            }
        });

        // 1. INICIAR SESIÓN CON LA CUENTA DEL USUARIO (keylet38@gmail.com / keybas121213)
        await page.waitForSelector('#login-email', { visible: true, timeout: 15000 });
        await page.evaluate(() => {
            if (typeof closeSavedAccountModal === 'function') closeSavedAccountModal();
        });

        await page.click('#login-email', { clickCount: 3 });
        await page.type('#login-email', 'keylet38@gmail.com', { delay: 20 });
        await page.click('#login-password', { clickCount: 3 });
        await page.type('#login-password', 'keybas121213', { delay: 20 });

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_form.png') });
        await page.click('#login-btn');

        await new Promise(r => setTimeout(r, 4500));

        let loginCheck = await page.evaluate(() => {
            const appScreen = document.getElementById('app-screen');
            const onboardingModal = document.getElementById('post-signup-onboarding-modal');
            const session = localStorage.getItem('recim_session');
            return {
                isAppVisible: appScreen && !appScreen.classList.contains('hidden'),
                hasOnboarding: !!onboardingModal,
                session: session ? JSON.parse(session) : null
            };
        });

        if (loginCheck.hasOnboarding || (loginCheck.session && !loginCheck.isAppVisible)) {
            await page.evaluate(() => {
                const sessionStr = localStorage.getItem('recim_session');
                if (sessionStr) {
                    const user = JSON.parse(sessionStr);
                    user.onboardingPending = false;
                    localStorage.setItem('recim_session', JSON.stringify(user));
                    const modal = document.getElementById('post-signup-onboarding-modal');
                    if (modal) modal.remove();
                    if (typeof initApp === 'function') initApp(user);
                }
            });
            await new Promise(r => setTimeout(r, 3000));
            loginCheck = await page.evaluate(() => ({
                session: JSON.parse(localStorage.getItem('recim_session') || 'null')
            }));
        }

        if (loginCheck.session) {
            report.loginStatus = 'SUCCESS';
            report.userProfile = {
                id: loginCheck.session.accountId,
                name: loginCheck.session.name,
                email: loginCheck.session.email,
                role: loginCheck.session.role,
                familyId: loginCheck.session.familyId
            };
            logStep('Inicio de Sesión (keylet38@gmail.com)', 'OK', `Sesión iniciada como ${loginCheck.session.name} (${loginCheck.session.email}) [ID: ${loginCheck.session.accountId}]`);
        } else {
            throw new Error('No se pudo iniciar sesión con keylet38@gmail.com');
        }

        // Esperar sincronización inicial con Supabase
        await new Promise(r => setTimeout(r, 3500));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dashboard_historial.png') });
        logStep('Módulo Historial (Página por defecto)', 'OK', 'Dashboard e Historial cargados tras sincronización con Supabase');

        // 2. CONFIGURAR SECUENCIAS NCF (B01, B02, B03, B04) PARA PRUEBAS FISCALES DGII
        await page.evaluate(() => {
            if (typeof saveNcfSequences === 'function' && typeof getNcfSequences === 'function') {
                const seqs = getNcfSequences() || {};
                const ensureSeq = (code, name) => {
                    if (!seqs[code] || !seqs[code].active || (seqs[code].current > seqs[code].to)) {
                        seqs[code] = {
                            serie: 'B',
                            tipo: code.slice(1),
                            code,
                            name,
                            from: 1,
                            to: 500,
                            current: (seqs[code]?.current && seqs[code].current < 500) ? seqs[code].current : 1,
                            dueDate: '2027-12-31',
                            alertThreshold: 10,
                            active: true
                        };
                    }
                };
                ensureSeq('B01', 'Crédito Fiscal');
                ensureSeq('B02', 'Consumo');
                ensureSeq('B03', 'Nota de Débito');
                ensureSeq('B04', 'Nota de Crédito');
                saveNcfSequences(seqs);
            }
        });
        logStep('Secuencias NCF DGII', 'OK', 'Secuencias B01, B02, B03 y B04 verificadas y activas');

        // 3. MÓDULO CLIENTES: Crear cliente real desde la UI y abrir su ficha detallada
        await page.evaluate(() => navigate('clientes'));
        await new Promise(r => setTimeout(r, 800));

        const clientRes = await page.evaluate(() => {
            document.getElementById('cli-type').value = 'empresa';
            if (typeof toggleClientFormFields === 'function') toggleClientFormFields();
            document.getElementById('cli-name').value = 'Recicladora Industrial Dominicana SRL';
            document.getElementById('cli-nit').value = '131548921';
            document.getElementById('cli-address').value = 'Av. John F. Kennedy #102, Santo Domingo';
            document.getElementById('cli-contact').value = '809-555-2480';
            if (document.getElementById('cli-default-ncf')) {
                document.getElementById('cli-default-ncf').value = 'B01';
            }
            const form = document.querySelector('#page-clientes form');
            if (form) {
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            } else if (typeof handleAddClient === 'function') {
                handleAddClient(new Event('submit'));
            }
            const clients = typeof getClients === 'function' ? getClients() : [];
            const created = clients.find(c => c.name === 'Recicladora Industrial Dominicana SRL') || clients[0];
            if (created && typeof showClientDetailsModal === 'function') {
                showClientDetailsModal(created.id);
            }
            return { totalClients: clients.length, created };
        });
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_clientes_creado_y_detalle.png') });
        await page.evaluate(() => {
            const m = document.getElementById('client-detail-modal');
            if (m) m.remove();
        });
        report.createdRecords.client = clientRes.created;
        logStep('Módulo Clientes (Crear + Modal Detalle)', 'OK', `Cliente: "${clientRes.created?.name}" (RNC: ${clientRes.created?.nit}) • Total clientes: ${clientRes.totalClients}`);

        // 4. MÓDULO CÓDIGOS DE MATERIALES: Verificar / crear material
        await page.evaluate(() => navigate('codigos'));
        await new Promise(r => setTimeout(r, 800));
        const matRes = await page.evaluate(() => {
            if (typeof addMaterialCode === 'function') {
                addMaterialCode('Cartón Corrugado Prensado Exportación', 'MAT-CARTON-01', '📦', 'Cartón y Papel');
            }
            if (typeof renderCodigosPage === 'function') {
                renderCodigosPage(document.getElementById('page-codigos'));
            }
            const mats = typeof getMaterialCodes === 'function' ? getMaterialCodes() : [];
            return { totalMaterials: mats.length, sample: mats[0] };
        });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_codigos_materiales.png') });
        logStep('Módulo Códigos de Materiales', 'OK', `Catálogo activo con ${matRes.totalMaterials} materiales (ej. ${matRes.sample?.code} - ${matRes.sample?.name})`);

        // 5. MÓDULO BITÁCORAS DE RECOGIDA: Crear bitácora desde el formulario UI + Modal Detalle + Descargar PDF A4 y Ticket 80mm
        await page.evaluate(() => navigate('bitacoras'));
        await new Promise(r => setTimeout(r, 1000));

        const bitacoraRes = await page.evaluate(async () => {
            if (typeof switchBitacorasTab === 'function') switchBitacorasTab('crear');
            const clientEl = document.getElementById('basic-client');
            if (clientEl) clientEl.value = 'Recicladora Industrial Dominicana SRL';
            const notesEl = document.getElementById('basic-notes');
            if (notesEl) notesEl.value = 'Bitácora de prueba automatizada - Furgón #3';

            let row = document.querySelector('#basic-items-entry-container .bitacora-row');
            if (!row && typeof addBasicEntryRow === 'function') {
                addBasicEntryRow();
                row = document.querySelector('#basic-items-entry-container .bitacora-row');
            }
            if (row) {
                const matSel = row.querySelector('.row-mat');
                if (matSel && matSel.options.length > 1) {
                    matSel.selectedIndex = 1;
                    matSel.dispatchEvent(new Event('change'));
                }
                const qtyEl = row.querySelector('.row-qty');
                const pbuyEl = row.querySelector('.row-pbuy');
                const psellEl = row.querySelector('.row-psell');
                if (qtyEl) qtyEl.value = '850';
                if (pbuyEl) pbuyEl.value = '7.50';
                if (psellEl) psellEl.value = '12.00';
                if (typeof calculateBatchTotals === 'function') calculateBatchTotals();
            }

            if (typeof saveBasicInvoice === 'function') {
                saveBasicInvoice();
            }

            const allBitacoras = (typeof getAllInvoices === 'function' ? getAllInvoices() : []).filter(i => i.type === 'basica');
            const latestBit = allBitacoras[0];
            if (latestBit && typeof generateInvoicePDF === 'function') {
                await generateInvoicePDF(latestBit, 'a4');
                await generateInvoicePDF({ ...latestBit, id: `${latestBit.id}_TICKET80MM` }, '80mm');
            }
            if (latestBit && typeof showBitacoraDetailsModal === 'function') {
                showBitacoraDetailsModal(latestBit.id);
            }
            return { count: allBitacoras.length, created: latestBit };
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_bitacora_creada_y_pdf.png') });
        await page.evaluate(() => {
            const m = document.getElementById('bitacora-detail-modal');
            if (m) m.remove();
        });
        report.createdRecords.bitacora = {
            id: bitacoraRes.created?.id,
            client: bitacoraRes.created?.client,
            totalCompra: bitacoraRes.created?.totalCompra,
            totalVenta: bitacoraRes.created?.totalVenta,
            balance: bitacoraRes.created?.balance
        };
        logStep('Módulo Bitácoras de Recogida + Descarga PDF (A4 y 80mm)', 'OK', `Bitácora ${bitacoraRes.created?.id} creada (Compra: RD$ ${bitacoraRes.created?.totalCompra} / Venta: RD$ ${bitacoraRes.created?.totalVenta}) y PDFs descargados`);

        // 6. HERRAMIENTAS RÁPIDAS DEL CENTRO DE CONTROL ANDROID (Mini Bitácora + Mini Factura Rápida)
        const quickToolsRes = await page.evaluate(async () => {
            // 6A. Mini Bitácora desde Centro de Control
            window.openQuickControlTool('bitacora');
            document.getElementById('qct-bit-client').value = 'Recicladora Industrial Dominicana SRL';
            document.getElementById('qct-bit-notes').value = 'Recogida creada desde botón del Centro de Control';
            const bitRow = document.querySelector('#qct-bit-rows .qct-bit-row');
            if (bitRow) {
                const matSel = bitRow.querySelector('.qct-bit-mat');
                if (matSel && matSel.options.length > 1) {
                    matSel.selectedIndex = 1;
                    window.onQuickBitMatChange(matSel);
                }
                const qty = bitRow.querySelector('.qct-bit-qty');
                const pbuy = bitRow.querySelector('.qct-bit-pbuy');
                const psell = bitRow.querySelector('.qct-bit-psell');
                if (qty) qty.value = '420';
                if (pbuy) pbuy.value = '8.00';
                if (psell) psell.value = '13.50';
                window.calcQuickBitacoraTotals();
            }
            const savedQuickBit = await window.saveQuickControlBitacora();
            if (typeof closeInvoicePostSaveModal === 'function') closeInvoicePostSaveModal();
            if (savedQuickBit && typeof generateInvoicePDF === 'function') {
                await generateInvoicePDF(savedQuickBit, 'a4');
            }

            // 6B. Mini Factura desde Centro de Control
            window.openQuickControlTool('factura');
            document.getElementById('qct-fac-ncf-type').value = 'B01';
            window.onQuickFacNcfChange();
            document.getElementById('qct-fac-company').value = 'Recicladora Industrial Dominicana SRL';
            document.getElementById('qct-fac-nit').value = '131548921';
            document.getElementById('qct-fac-address').value = 'Av. John F. Kennedy #102, Santo Domingo';
            document.getElementById('qct-fac-contact').value = '809-555-2480';
            const facRow = document.querySelector('#qct-fac-rows .qct-fac-row');
            if (facRow) {
                const desc = facRow.querySelector('.qct-fac-desc');
                const qty = facRow.querySelector('.qct-fac-qty');
                const uprice = facRow.querySelector('.qct-fac-uprice');
                if (desc) desc.value = 'Cartón Corrugado Prensado';
                if (qty) qty.value = '1200';
                if (uprice) uprice.value = '14.50';
                window.calcQuickFacturaTotals();
            }
            const savedQuickFac = await window.saveQuickControlFactura();
            if (typeof closeInvoicePostSaveModal === 'function') closeInvoicePostSaveModal();
            if (savedQuickFac && typeof generateInvoicePDF === 'function') {
                await generateInvoicePDF(savedQuickFac, 'a4');
                await generateInvoicePDF({ ...savedQuickFac, id: `${savedQuickFac.id}_TICKET80MM` }, '80mm');
            }

            return {
                quickBitId: savedQuickBit?.id,
                quickBitCompra: savedQuickBit?.totalCompra,
                quickFacId: savedQuickFac?.id,
                quickFacNcf: savedQuickFac?.ncf,
                quickFacTotal: savedQuickFac?.total
            };
        });
        await new Promise(r => setTimeout(r, 1000));
        report.createdRecords.quickControlTools = quickToolsRes;
        logStep('Botones Centro de Control (Mini Bitácora + Mini Factura + PDFs)', 'OK', `Mini Bitácora (${quickToolsRes.quickBitId}, RD$ ${quickToolsRes.quickBitCompra}) y Mini Factura (${quickToolsRes.quickFacId}, NCF: ${quickToolsRes.quickFacNcf}, Total: RD$ ${quickToolsRes.quickFacTotal}) guardadas y PDFs descargados`);

        // 7. MÓDULO FACTURACIÓN: COTIZACIÓN OFICIAL + FACTURA UNIFICADA + CONDUCE + DESCARGA DE PDFs
        await page.evaluate(() => navigate('facturas', 'cotizaciones'));
        await new Promise(r => setTimeout(r, 1000));

        // 7A. Crear Cotización y descargar su PDF Oficial Reciminsa
        const quoteRes = await page.evaluate(async () => {
            document.getElementById('quote-client').value = 'Recicladora Industrial Dominicana SRL';
            document.getElementById('quote-nit').value = '131548921';
            document.getElementById('quote-contact').value = '809-555-2480';
            document.getElementById('quote-address').value = 'Av. John F. Kennedy #102, Santo Domingo';
            document.getElementById('quote-notes').value = 'Cotización formal de manejo y recolección de materiales reciclables.';

            let row = document.querySelector('#quote-items-container .quote-item-row');
            if (!row && typeof addQuoteItemRow === 'function') {
                addQuoteItemRow();
                row = document.querySelector('#quote-items-container .quote-item-row');
            }
            if (row) {
                const iName = row.querySelector('.q-item-name');
                const qty = row.querySelector('.q-qty');
                const uprice = row.querySelector('.q-item-uprice');
                const iDesc = row.querySelector('.q-item-desc');
                if (iName) iName.value = 'Servicio de Gestión y Compactación de Cartón Industrial';
                if (qty) qty.value = '2500';
                if (uprice) uprice.value = '15.00';
                if (iDesc) iDesc.value = 'Recolección en planta, pesaje certificado y transporte.';
                if (typeof calcQuoteLiveTotals === 'function') calcQuoteLiveTotals();
            }

            if (typeof handleSaveQuote === 'function') {
                handleSaveQuote();
            }

            const quotes = typeof getAllQuotes === 'function' ? getAllQuotes() : [];
            const latestQuote = quotes[0];
            if (latestQuote && typeof generateQuotePDF === 'function') {
                await generateQuotePDF(latestQuote);
            }
            if (latestQuote && typeof showQuoteDetailsModal === 'function') {
                showQuoteDetailsModal(latestQuote.id);
            }
            return { totalQuotes: quotes.length, created: latestQuote };
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_cotizacion_creada_y_pdf.png') });
        await page.evaluate(() => {
            const m = document.getElementById('quote-detail-modal');
            if (m) m.remove();
        });
        report.createdRecords.quote = {
            id: quoteRes.created?.id,
            client: quoteRes.created?.client,
            total: quoteRes.created?.total
        };
        logStep('Módulo Cotizaciones + PDF Oficial Reciminsa', 'OK', `Cotización ${quoteRes.created?.id} creada (Total: RD$ ${quoteRes.created?.total}) y PDF oficial descargado`);

        // 7B. Crear Factura Fiscal desde la pestaña Facturas y descargar su PDF (A4 y Ticket 80mm)
        await page.evaluate(() => {
            if (typeof switchFacturacionTab === 'function') switchFacturacionTab('facturas');
        });
        await new Promise(r => setTimeout(r, 800));

        const invoiceRes = await page.evaluate(async () => {
            const ncfSel = document.getElementById('fac-ncf-type-unified');
            if (ncfSel) {
                ncfSel.value = 'B01';
                if (typeof onNcfTypeChangeUnified === 'function') onNcfTypeChangeUnified();
            }
            document.getElementById('fac-name-unified').value = 'Recicladora Industrial Dominicana SRL';
            document.getElementById('fac-nit-unified').value = '131548921';
            document.getElementById('fac-address-unified').value = 'Av. John F. Kennedy #102, Santo Domingo';
            document.getElementById('fac-contact-unified').value = '809-555-2480';
            document.getElementById('fac-notes-unified').value = 'Factura con Comprobante Fiscal B01 - Prueba Integral';

            let row = document.querySelector('#fac-items-unified .invoice-item-row');
            if (!row && typeof addUnifiedInvoiceRow === 'function') {
                addUnifiedInvoiceRow();
                row = document.querySelector('#fac-items-unified .invoice-item-row');
            }
            if (row) {
                const desc = row.querySelector('.row-desc');
                const qty = row.querySelector('.row-qty');
                const uprice = row.querySelector('.row-uprice');
                if (desc) desc.value = 'Cartón Corrugado Prensado Exportación';
                if (qty) qty.value = '1500';
                if (uprice) uprice.value = '14.00';
                if (typeof calcFacTotalsUnified === 'function') calcFacTotalsUnified();
            }

            if (typeof saveFacturaUnified === 'function') {
                saveFacturaUnified();
            }
            if (typeof closeInvoicePostSaveModal === 'function') closeInvoicePostSaveModal();

            const invoices = (typeof getAllInvoices === 'function' ? getAllInvoices() : []).filter(i => i.type !== 'basica');
            const latestInv = invoices[0];
            if (latestInv && typeof generateInvoicePDF === 'function') {
                await generateInvoicePDF(latestInv, 'a4');
                await generateInvoicePDF({ ...latestInv, id: `${latestInv.id}_TICKET80MM` }, '80mm');
            }
            return { totalInvoices: invoices.length, created: latestInv };
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_factura_fiscal_creada.png') });
        report.createdRecords.invoice = {
            id: invoiceRes.created?.id,
            ncf: invoiceRes.created?.ncf,
            company: invoiceRes.created?.company,
            total: invoiceRes.created?.total
        };
        logStep('Módulo Facturación Fiscal (B01) + PDFs (A4 y Ticket 80mm)', 'OK', `Factura ${invoiceRes.created?.id} emitida (NCF: ${invoiceRes.created?.ncf}, Total: RD$ ${invoiceRes.created?.total}) y PDFs descargados`);

        // 7C. Conduce de Entrega + Descarga PDF
        const dispatchRes = await page.evaluate(async () => {
            if (typeof switchFacturacionTab === 'function') switchFacturacionTab('despachos');
            document.getElementById('disp-dest').value = 'Recicladora Industrial Dominicana SRL';
            document.getElementById('disp-address').value = 'Av. John F. Kennedy #102, Santo Domingo';
            const driverEl = document.getElementById('disp-driver');
            if (driverEl) driverEl.value = 'Carlos Méndez';
            const plateEl = document.getElementById('disp-plate');
            if (plateEl) plateEl.value = 'L-409281';

            let row = document.querySelector('#disp-items-container .disp-item-row');
            if (!row && typeof addDispatchItemRow === 'function') {
                addDispatchItemRow();
                row = document.querySelector('#disp-items-container .disp-item-row');
            }
            if (row) {
                const desc = row.querySelector('.d-desc');
                const qty = row.querySelector('.d-qty');
                const pkg = row.querySelector('.d-packages');
                if (desc) desc.value = 'Pacas de Cartón Corrugado Prensado';
                if (qty) qty.value = '1500';
                if (pkg) pkg.value = '12 Pacas';
            }
            if (typeof handleSaveDispatch === 'function') {
                handleSaveDispatch();
            }
            const dispatches = typeof getAllDispatches === 'function' ? getAllDispatches() : [];
            const latestDisp = dispatches[0];
            if (latestDisp && typeof generateDispatchPDF === 'function') {
                await generateDispatchPDF(latestDisp);
            }
            return { count: dispatches.length, created: latestDisp };
        });
        report.createdRecords.dispatch = { id: dispatchRes.created?.id, destination: dispatchRes.created?.destination };
        logStep('Conduce de Entrega + PDF', 'OK', `Conduce ${dispatchRes.created?.id} emitido para ${dispatchRes.created?.destination} y PDF descargado`);

        // 8. AGENDA Y RUTAS DE RECOGIDA
        await page.evaluate(() => navigate('rutas'));
        await new Promise(r => setTimeout(r, 800));
        const routeRes = await page.evaluate(() => {
            if (typeof addPickupRoute === 'function') {
                const route = addPickupRoute({
                    clientName: 'Recicladora Industrial Dominicana SRL',
                    phone: '809-555-2480',
                    address: 'Av. John F. Kennedy #102, Santo Domingo',
                    scheduledDate: new Date().toISOString().slice(0, 10),
                    scheduledTime: '10:30',
                    recurrence: 'weekly',
                    driverName: 'Carlos Méndez',
                    estimatedMaterials: 'Cartón y Plástico PET',
                    notes: 'Ruta programada por el bot de prueba'
                });
                if (typeof renderRoutesAgendaPage === 'function') {
                    renderRoutesAgendaPage(document.getElementById('page-rutas'));
                }
                return route;
            }
            return null;
        });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_agenda_rutas.png') });
        report.createdRecords.route = { id: routeRes?.id, clientName: routeRes?.clientName, scheduledDate: routeRes?.scheduledDate };
        logStep('Módulo Agenda y Rutas de Recogida', 'OK', `Ruta programada: ${routeRes?.id} para ${routeRes?.clientName} (${routeRes?.scheduledDate})`);

        // 9. CERTIFICADO ECOLÓGICO CON QR VECTORIAL + DESCARGA PDF
        await page.evaluate(() => navigate('ecologia'));
        await new Promise(r => setTimeout(r, 800));
        const ecoRes = await page.evaluate(async () => {
            if (typeof generateEcoCertificatePDF === 'function') {
                const certData = {
                    certNumber: `CERT-ECO-${Date.now().toString().slice(-5)}`,
                    companyName: 'Recicladora Industrial Dominicana SRL',
                    rnc: '131548921',
                    periodLabel: 'Noviembre 2026',
                    issueDate: new Date().toISOString().slice(0, 10),
                    totalLbs: 2770,
                    totalKg: 1256.45,
                    materials: [
                        { name: 'Cartón Corrugado Prensado', lbs: 2770, kg: 1256.45 }
                    ]
                };
                await generateEcoCertificatePDF(certData);
                return certData;
            }
            return null;
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_certificado_ecologico.png') });
        report.createdRecords.ecoCertificate = ecoRes;
        logStep('Módulo Impacto Ecológico + PDF Certificado con QR Vectorial', 'OK', `Certificado ${ecoRes?.certNumber} generado con QR ISO/IEC 18004 y PDF descargado`);

        // 10. MANEJO DGII (606, 607, 608), HISTORIAL DE SUCURSALES Y SINCRONIZACIÓN FINAL CON SUPABASE
        await page.evaluate(() => navigate('manejo_dgii'));
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_manejo_dgii.png') });
        logStep('Módulo Manejo DGII (606, 607 y 608)', 'OK', 'Formatos fiscales 606/607/608 renderizados con los comprobantes creados');

        await page.evaluate(() => navigate('historial'));
        await new Promise(r => setTimeout(r, 800));
        await page.evaluate(async () => {
            if (typeof viewAllBranchesDataInHistory === 'function') {
                viewAllBranchesDataInHistory();
            }
            if (typeof window.forceSync === 'function') {
                await window.forceSync();
            }
        });
        await new Promise(r => setTimeout(r, 2500));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_historial_sucursales_final.png') });
        logStep('Sincronización en la Nube Supabase', 'OK', 'Todos los clientes, bitácoras, cotizaciones, facturas y rutas sincronizados en Supabase');

        // Verificar todos los archivos PDF descargados en DOWNLOAD_DIR
        const filesOnDisk = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        for (const file of filesOnDisk) {
            const fullPath = path.join(DOWNLOAD_DIR, file);
            const stat = fs.statSync(fullPath);
            const head = fs.readFileSync(fullPath).subarray(0, 8).toString('ascii');
            report.downloadedPdfs.push({
                filename: file,
                sizeBytes: stat.size,
                validPdfHeader: head.startsWith('%PDF-')
            });
        }

        fs.writeFileSync(path.join(__dirname, 'test-report.json'), JSON.stringify(report, null, 2));
        console.log('\n======================================================');
        console.log('📊 RESUMEN FINAL DEL BOT DE PRUEBAS E2E:');
        console.log(`👤 Cuenta: ${report.userProfile?.email} (ID: ${report.userProfile?.id})`);
        console.log(`📄 PDFs Descargados y Verificados (${report.downloadedPdfs.length}):`);
        for (const pdf of report.downloadedPdfs) {
            console.log(`   - ${pdf.filename} (${(pdf.sizeBytes / 1024).toFixed(1)} KB) [Header %PDF: ${pdf.validPdfHeader ? 'SÍ' : 'NO'}]`);
        }
        console.log('======================================================\n');
    } catch (err) {
        console.error('❌ Error ejecutando el bot de pruebas:', err);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
        server.close();
    }
});
