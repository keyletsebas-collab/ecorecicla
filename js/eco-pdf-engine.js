/* =========================================================================
   ECO-PDF-ENGINE.JS – Motor Especializado de Certificados de Impacto Verde
   Inspirado y estructurado con el motor nativo de jsPDF de pdf-utils.js.
   Generación de PDF vectorial pura sin dependencia de captura de DOM.
   ========================================================================= */

function generateClientCertCode(clientName) {
  if (!clientName) return 'MSSZQ5MI';
  let hash = 5381;
  const str = clientName.trim().toUpperCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  const positive = Math.abs(hash).toString(36).toUpperCase();
  return (positive + 'RECIMINSA').slice(0, 8);
}

function generateEcoImpactPDFEngine(options = {}) {
    const {
        clientName = null,
        startDate = null,
        endDate = null,
        invoices = [],
        customTitle = null,
        onSuccess = null,
        onError = null,
        certCode = null
    } = options;

    // 1. Obtener estadísticas de impacto ecológico
    const targetInvoices = invoices && invoices.length > 0 ? invoices : (typeof getAllInvoices === 'function' ? getAllInvoices() : []);
    const stats = typeof calculateEcoImpact === 'function' ? calculateEcoImpact(targetInvoices, clientName, startDate, endDate) : null;

    if (!stats || stats.totalWeight === 0) {
        if (typeof showToast === 'function') {
            const msg = typeof t === 'function' ? t('eco.toast_no_invoices') : '⚠️ No hay datos registrados para este cliente en el rango seleccionado';
            showToast(msg, 'warning');
        }
        if (onError) onError('No hay datos');
        return;
    }

    if (typeof showToast === 'function') {
        showToast('🌱 Generando Certificado Oficial de Impacto Ambiental...', 'info', 3000);
    }

    // 2. Obtener la configuración corporativa (Registro de Empresa: Nombre, Logo, RNC, Teléfono, Correo, Dirección)
    let settings = {};
    if (typeof getSettings === 'function') {
        settings = getSettings();
    } else {
        try {
            const sessionStr = localStorage.getItem('recim_session');
            let accountId = 'default';
            if (sessionStr) accountId = JSON.parse(sessionStr).accountId || 'default';
            const key = typeof userKey === 'function' ? userKey('recim_settings') : `recim_settings_${accountId}`;
            settings = JSON.parse(localStorage.getItem(key) || '{}');
            if (!settings.companyName) {
                settings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
            }
        } catch (_) {}
    }

    let companyName = settings.companyName || 'RECIMINSA';
    let companyLogo = settings.companyLogo || settings.logoUrl || (typeof window !== 'undefined' ? window.DEFAULT_APP_LOGO : '') || '';
    let rnc = settings.companyRNC || settings.rnc || settings.companyRnc || '';
    let phone = settings.companyPhone || settings.phone || settings.userPhone || '';
    let email = settings.companyEmail || settings.userEmail || '';
    let address = settings.companyAddress || '';

    if (typeof userKey === 'function') {
        try {
            const sharedSettings = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
            if (sharedSettings.companyName) companyName = sharedSettings.companyName;
            if (sharedSettings.companyRNC) rnc = sharedSettings.companyRNC;
            if (sharedSettings.companyPhone) phone = sharedSettings.companyPhone;
            if (sharedSettings.companyEmail) email = sharedSettings.companyEmail;
            if (sharedSettings.companyAddress) address = sharedSettings.companyAddress;
            if (sharedSettings.companyLogo) companyLogo = sharedSettings.companyLogo;
        } catch (e) {}
    }

    const certId = certCode || (clientName ? generateClientCertCode(clientName) : `ECO-${Date.now().toString(36).toUpperCase().slice(-6)}`);

    // 3. Fechas formateadas
    const formatTextDate = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const periodText = startDate && endDate 
        ? `Período del ${formatTextDate(startDate)} al ${formatTextDate(endDate)}`
        : 'Período acumulado al presente';

    const targetClient = clientName || 'TODOS LOS CLIENTES (CERTIFICADO GENERAL)';
    const issueDate = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });

    // 4. Calcular porcentajes y peso por tipo de material
    const totalW = stats.totalWeight || 1;
    const materialsBreakdown = [
        { name: 'Papel y Cartón', weight: stats.paperWeight, color: [16, 185, 129] },
        { name: 'Plásticos (PET/HDPE/Film)', weight: stats.plasticWeight, color: [59, 130, 246] },
        { name: 'Metales (Aluminio/Cobre/Hierro)', weight: stats.metalWeight, color: [245, 158, 11] },
        { name: 'Vidrio', weight: stats.glassWeight, color: [139, 92, 246] },
        { name: 'Otros / Mezclados', weight: stats.otherWeight, color: [100, 116, 139] }
    ].map(m => ({
        ...m,
        pct: ((m.weight / totalW) * 100).toFixed(1)
    }));

    // 5. Obtener constructor jsPDF usando getJsPDFConstructor (idéntico a pdf-utils.js)
    const jsPDFConstructor = typeof getJsPDFConstructor === 'function' 
        ? getJsPDFConstructor() 
        : (window.jsPDF || (window.jspdf && window.jspdf.jsPDF) || (window.html2pdf && window.html2pdf.jsPDF));

    if (!jsPDFConstructor) {
        console.error('jsPDF NOT FOUND');
        if (typeof showToast === 'function') showToast('❌ Error: Librería jsPDF no disponible', 'error');
        if (onError) onError('jsPDF not found');
        return;
    }

    // 6. Instanciar documento Carta Apaisado (279.4mm x 215.9mm)
    const doc = new jsPDFConstructor({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter'
    });

    const pageWidth = 279.4;
    const pageHeight = 215.9;

    // --- A. FONDO Y MARCO DE HONOR (Doble Borde Verde Esmeralda) ---
    doc.setFillColor(240, 253, 244);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Borde exterior
    doc.setDrawColor(5, 150, 105); // Verde esmeralda #059669
    doc.setLineWidth(1.2);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    // Borde interior
    doc.setDrawColor(52, 211, 153); // #34d399
    doc.setLineWidth(0.4);
    doc.rect(10.5, 10.5, pageWidth - 21, pageHeight - 21);

    // Fondo blanco del cuerpo interno
    doc.setFillColor(255, 255, 255);
    doc.rect(12, 12, pageWidth - 24, pageHeight - 24, 'F');

    // --- B. CABECERA INSTITUCIONAL ---
    let logoDrawn = false;
    if (companyLogo && (companyLogo.startsWith('data:image/') || companyLogo.includes('base64'))) {
        try {
            let logoFormat = 'PNG';
            if (companyLogo.includes('image/jpeg') || companyLogo.includes('image/jpg')) logoFormat = 'JPEG';
            doc.addImage(companyLogo, logoFormat, 16, 16, 32, 14);
            logoDrawn = true;
        } catch (e) {
            console.error('Error dibujando logo en certificado:', e);
        }
    }

    const textLeftX = logoDrawn ? 52 : 16;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(6, 95, 70);
    doc.text(companyName, textLeftX, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text("Gestión Integral de Reciclaje & Desarrollo Sostenible", textLeftX, 24.5);

    const contactParts = [];
    if (rnc) contactParts.push(`RNC: ${rnc}`);
    if (phone) contactParts.push(`Tel: ${phone}`);
    if (email) contactParts.push(`Email: ${email}`);

    if (contactParts.length > 0) {
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(contactParts.join(' | '), textLeftX, 28.5);
    }



    // Línea divisoria cabecera
    doc.setDrawColor(167, 243, 208);
    doc.setLineWidth(0.5);
    doc.line(16, 33, 263.4, 33);

    // --- C. TÍTULO PRINCIPAL Y OTORGAMIENTO ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text(customTitle || 'CERTIFICADO DE IMPACTO MEDIOAMBIENTAL', pageWidth / 2, 40, { align: 'center' });

    doc.setFont('Times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59);
    doc.text("Reconocimiento de Excelencia Verde", pageWidth / 2, 49, { align: 'center' });

    // Barrita decorativa central
    doc.setFillColor(16, 185, 129);
    doc.roundedRect((pageWidth / 2) - 25, 52, 50, 1.2, 0.6, 0.6, 'F');

    doc.setFont('Helvetica', 'oblique');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Otorgado solemnemente a la entidad o corporación:", pageWidth / 2, 59, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(4, 120, 87);
    doc.text(targetClient.toUpperCase(), pageWidth / 2, 67, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`Por su valiosa contribución al desarrollo sostenible y la economía circular durante el ${periodText},`, pageWidth / 2, 73, { align: 'center' });
    doc.text(`canalizando un total de ${stats.totalWeight.toLocaleString('es-DO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg (${(stats.totalWeight / 1000).toFixed(2)} Toneladas) de material reciclable devuelto al ciclo productivo.`, pageWidth / 2, 77.5, { align: 'center' });

    // --- D. 5 TARJETAS DE IMPACTO ECOLÓGICO ---
    const cardsY = 82;
    const cardW = 46.8;
    const cardH = 26;
    const cardGap = 3.1;
    const startX = 16;

    const cardsData = [
        { label: 'TOTAL RECICLADO', val: `${stats.totalWeight.toFixed(1)} kg`, color: [4, 120, 87] },
        { label: 'ÁRBOLES SALVADOS', val: `${Math.ceil(stats.treesSaved)}`, color: [5, 150, 105] },
        { label: 'AGUA CONSERVADA', val: `${Math.round(stats.waterSaved).toLocaleString()} L`, color: [2, 132, 199] },
        { label: 'ENERGÍA AHORRADA', val: `${Math.round(stats.energySaved).toLocaleString()} kWh`, color: [217, 119, 6] },
        { label: 'CO2 EVITADO', val: `${Math.round(stats.co2Avoided).toLocaleString()} kg`, color: [124, 58, 237] }
    ];

    cardsData.forEach((c, idx) => {
        const cx = startX + idx * (cardW + cardGap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(167, 243, 208);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, cardsY, cardW, cardH, 2, 2, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(c.color[0], c.color[1], c.color[2]);
        doc.text(c.val, cx + (cardW / 2), cardsY + 12, { align: 'center' });

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, cx + (cardW / 2), cardsY + 20, { align: 'center' });
    });

    // --- E. TABLA DE COMPOSICIÓN Y SELLO/FIRMAS ---
    const boxY = 112;
    const boxH = 60;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(16, boxY, 247.4, boxH, 2.5, 2.5, 'FD');

    // Columna Izquierda: Desglose de Materiales
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    doc.text("COMPOSICIÓN DEL MATERIAL PROCESADO:", 22, boxY + 8);

    let rowY = boxY + 14;
    materialsBreakdown.forEach(m => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(m.name, 22, rowY);
        doc.text(`${m.weight.toFixed(1)} kg (${m.pct}%)`, 135, rowY, { align: 'right' });

        // Bar Track
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(22, rowY + 1.5, 113, 3, 1, 1, 'F');

        // Bar Fill
        const fillW = Math.max(1, (parseFloat(m.pct) / 100) * 113);
        doc.setFillColor(m.color[0], m.color[1], m.color[2]);
        doc.roundedRect(22, rowY + 1.5, fillW, 3, 1, 1, 'F');

        rowY += 9;
    });

    // Separador vertical discontinuo
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(143, boxY + 5, 143, boxY + boxH - 5);
    doc.setLineDashPattern([], 0);

    // Sello Oficial de Empresa
    const sealCx = 168;
    const sealCy = boxY + 25;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.8);
    doc.circle(sealCx, sealCy, 14, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(4, 120, 87);
    doc.text("SELLO OFICIAL", sealCx, sealCy - 1.5, { align: 'center' });
    doc.setFontSize(4.8);
    doc.setTextColor(5, 150, 105);
    doc.text("DE EMPRESA", sealCx, sealCy + 2.5, { align: 'center' });

    // Firma de Dirección
    const sigX = 202;
    const sigY = boxY + 34;
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY, sigX + 50, sigY);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, sigX + 25, sigY + 4.5, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Dirección de Sostenibilidad", sigX + 25, sigY + 8, { align: 'center' });

    // Metadatos
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emisión: ${issueDate}`, 150, boxY + 53);
    doc.text(`Código Validación: ${certId.slice(-8)}`, 255, boxY + 53, { align: 'right' });

    // --- F. PIE DE PÁGINA AUDITABLE ---
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(16, 178, 263.4, 178);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Este certificado auditable valida que los materiales fueron clasificados y procesados mediante métodos de reciclaje ecológicos.", 16, 183);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text("Página 1 de 1 • Certificado Ecológico Oficial", 263.4, 183, { align: 'right' });

    // 7. Exportación y Descarga Multiplataforma (Copiado de la lógica de pdf-utils.js)
    const filename = `Certificado_Impacto_${(targetClient || 'General').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    let base64Data = '';
    try {
        base64Data = doc.output('datauristring').split(',')[1] || '';
    } catch (_) {}

    // PUENTE NATIVO WINDOWS / MAUI WEBVIEW2
    if (window.chrome && window.chrome.webview) {
        try {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'download',
                filename: filename,
                data: base64Data
            }));
            if (typeof showToast === 'function') showToast('✅ Certificado enviado a descargas', 'success');
            if (onSuccess) onSuccess(doc.output('blob'));
            return;
        } catch (e) {
            console.warn('WebView bridge error:', e);
        }
    }

    // DESCARGA ESTÁNDAR
    try {
        doc.save(filename);
        if (typeof showToast === 'function') showToast('✅ Certificado PDF descargado con éxito', 'success');
        if (onSuccess) onSuccess(doc.output('blob'));
    } catch (err) {
        console.error('Error guardando PDF:', err);
        if (typeof showToast === 'function') showToast('❌ Error al guardar el certificado PDF', 'error');
        if (onError) onError(err);
    }
}


