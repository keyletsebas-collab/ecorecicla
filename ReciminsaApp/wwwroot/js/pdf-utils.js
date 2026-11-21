/* =========================================================================
   PDF-UTILS.JS – Generación de PDF Global Mejorado (Versión Premium)
   Soporta Formato Corporativo (Carta) y Formato Ticket (POS 80mm)
   ========================================================================= */

function getActiveCompanyIssuerInfo() {
    let settings = {};
    try {
        if (typeof getSettings === 'function') {
            settings = getSettings() || {};
        }
    } catch (_) {}

    if (!settings || Object.keys(settings).length === 0) {
        try {
            const sessionStr = localStorage.getItem('recim_session');
            let accountId = 'default';
            if (sessionStr) {
                accountId = JSON.parse(sessionStr).accountId || 'default';
            }
            const key = typeof userKey === 'function' ? userKey('recim_settings') : `recim_settings_${accountId}`;
            settings = JSON.parse(localStorage.getItem(key) || '{}');
            if (!settings.companyName) {
                settings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
            }
        } catch (e) {
            console.error("Error reading settings in PDF:", e);
        }
    }

    let companyName = settings.companyName || '';
    let companyAddr = settings.companyAddress || '';
    let companyRNC = settings.companyRNC || settings.rnc || settings.companyRnc || '';
    let companyTel = settings.companyPhone || settings.userPhone || '';
    let companyEmail = settings.companyEmail || settings.userEmail || '';
    let companySlogan = settings.companySlogan || '';
    let companyLogo = (typeof getCachedCompanyLogo === 'function' ? getCachedCompanyLogo() : null) ||
                      settings.companyLogo ||
                      window.DEFAULT_APP_LOGO || '';

    if (typeof userKey === 'function') {
        try {
            const sharedSettings = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
            if (sharedSettings.companyName) companyName = sharedSettings.companyName;
            if (sharedSettings.companyRNC) companyRNC = sharedSettings.companyRNC;
            if (sharedSettings.companyPhone || sharedSettings.userPhone) companyTel = sharedSettings.companyPhone || sharedSettings.userPhone;
            if (sharedSettings.companyEmail || sharedSettings.userEmail) companyEmail = sharedSettings.companyEmail || sharedSettings.userEmail;
            if (sharedSettings.companyAddress) companyAddr = sharedSettings.companyAddress;
            if (sharedSettings.companySlogan) companySlogan = sharedSettings.companySlogan;
            if (sharedSettings.companyLogo) companyLogo = sharedSettings.companyLogo;
        } catch (e) {
            console.error('Error loading shared settings in PDF:', e);
        }
    }

    return {
        companyName: companyName || 'Empresa No Configurada',
        companyAddr: companyAddr || '',
        companyRNC: String(companyRNC || '').trim(),
        companyTel: companyTel || '',
        companyEmail: companyEmail || '',
        companySlogan: companySlogan || '',
        companyLogo
    };
}
window.getActiveCompanyIssuerInfo = getActiveCompanyIssuerInfo;

function resolvePdfBranchDetails(docObj, issuer = null) {
    const safeIssuer = issuer || getActiveCompanyIssuerInfo();
    let rawBranchId = docObj?.branchId || '';
    if (!rawBranchId && typeof getActiveBranchId === 'function') {
        try { rawBranchId = getActiveBranchId(); } catch (_) {}
    }
    const normId = (typeof normalizeBranchId === 'function')
        ? normalizeBranchId(rawBranchId)
        : (String(rawBranchId || '').trim() || 'SUC-PRINCIPAL');

    let matchedBranch = null;
    try {
        if (typeof getCompanyBranches === 'function') {
            const branches = getCompanyBranches() || [];
            matchedBranch = branches.find(b => {
                if (!b) return false;
                const bid = (typeof normalizeBranchId === 'function')
                    ? normalizeBranchId(b.id)
                    : (String(b.id || '').trim() || 'SUC-PRINCIPAL');
                return bid === normId;
            }) || null;
        }
    } catch (_) {}

    const branchName = (matchedBranch && matchedBranch.name)
        || docObj?.branchName
        || (typeof resolveBranchNameById === 'function' ? resolveBranchNameById(normId) : '')
        || (normId === 'SUC-PRINCIPAL' ? 'Sucursal Principal' : normId);

    const branchLocation = (matchedBranch && matchedBranch.location)
        || docObj?.branchLocation
        || safeIssuer.companyAddr
        || '';

    const branchPhone = (matchedBranch && matchedBranch.phone)
        || safeIssuer.companyTel
        || '';

    return {
        branchId: normId,
        branchName: String(branchName || 'Sucursal Principal').trim(),
        branchLocation: String(branchLocation || '').trim(),
        branchPhone: String(branchPhone || '').trim()
    };
}
window.resolvePdfBranchDetails = resolvePdfBranchDetails;

function _detectLogoFormat(logoDataUrl) {
    if (!logoDataUrl || typeof logoDataUrl !== 'string') return 'PNG';
    const lower = logoDataUrl.slice(0, 64).toLowerCase();
    if (lower.includes('image/jpeg') || lower.includes('image/jpg')) return 'JPEG';
    if (lower.includes('image/webp')) return 'WEBP';
    return 'PNG';
}

async function _computePdfLogoDimensions(companyLogo, maxW, maxH) {
    if (!companyLogo || typeof companyLogo !== 'string' ||
        (!companyLogo.startsWith('data:image/') && !companyLogo.includes('base64'))) {
        return { hasLogo: false, width: 0, height: 0, format: 'PNG' };
    }
    const format = _detectLogoFormat(companyLogo);
    let w = maxW;
    let h = maxH;
    try {
        const dims = await getImageDimensions(companyLogo);
        if (dims && dims.width > 0 && dims.height > 0) {
            const aspect = dims.width / dims.height;
            w = maxW;
            h = w / aspect;
            if (h > maxH) {
                h = maxH;
                w = h * aspect;
            }
        }
    } catch (_) {}
    return { hasLogo: true, width: w, height: h, format };
}

function _resolveInvoiceNcfDueDateFormatted(docObj) {
    let raw = docObj?.ncfDueDate || '';
    if (!raw && typeof getNcfSequences === 'function' && docObj?.ncfType) {
        try {
            const seqs = getNcfSequences() || {};
            raw = seqs[docObj.ncfType]?.dueDate || '';
        } catch (_) {}
    }
    raw = String(raw || '').trim();
    if (!raw) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
}

function safeFormatMoney(amount) {
    if (typeof formatMoney === 'function') {
        return formatMoney(amount);
    }
    const num = parseFloat(amount) || 0;
    return 'RD$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function base64ToBlob(base64, mimeType = 'application/pdf') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

function numeroALetras(num) {
    const currencyName = 'PESOS';
    const centavosName = 'DOP';

    const unidades = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = {
        10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
        20: 'VEINTE', 21: 'VEINTIÚN', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
        25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
    };
    const centenas = ['CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    
    function convCentena(n) {
        if (n === 0) return '';
        if (n === 100) return 'CIEN';
        const c = Math.floor(n / 100);
        const rest = n % 100;
        let s = '';
        if (c > 0) s += centenas[c - 1] + ' ';
        if (rest > 0) {
            if (rest < 10) {
                s += unidades[rest - 1];
            } else if (especiales[rest]) {
                s += especiales[rest];
            } else {
                const d = Math.floor(rest / 10);
                const u = rest % 10;
                s += decenas[d - 1];
                if (u > 0) s += ' Y ' + unidades[u - 1];
            }
        }
        return s.trim();
    }

    function convEntero(n) {
        if (n === 0) return '';
        if (n < 1000) return convCentena(n);
        if (n < 1000000) {
            const miles = Math.floor(n / 1000);
            const resto = n % 1000;
            const strMiles = miles === 1 ? 'MIL' : convCentena(miles) + ' MIL';
            const strResto = convCentena(resto);
            return (strMiles + ' ' + strResto).trim();
        }
        if (n < 1000000000000) {
            const millones = Math.floor(n / 1000000);
            const resto = n % 1000000;
            const strMillones = millones === 1 ? 'UN MILLÓN' : convEntero(millones) + ' MILLONES';
            const strResto = convEntero(resto);
            return (strMillones + ' ' + strResto).trim();
        }
        return 'MONTO MUY GRANDE';
    }

    if (num === 0) return `CERO ${currencyName}`;
    
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);
    
    const letras = convEntero(entero);
    const dePrefix = (entero >= 1000000 && entero % 1000000 === 0) ? 'DE ' : '';
    const centavosStr = String(centavos).padStart(2, '0');
    return `SON: ${letras.trim()} ${dePrefix}${currencyName} CON ${centavosStr}/100 ${centavosName}`;
}

// Obtener constructor jsPDF dinámicamente
function getJsPDFConstructor() {
    if (typeof window.html2pdf !== 'undefined' && typeof window.html2pdf.jsPDF === 'function') {
        return window.html2pdf.jsPDF;
    } else if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF === 'function') {
        return window.jspdf.jsPDF;
    } else if (typeof window.jsPDF === 'function') {
        return window.jsPDF;
    } else if (typeof jsPDF === 'function') {
        return jsPDF;
    }
    return null;
}

function getImageDimensions(base64Str) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            resolve({ width: 0, height: 0 });
        };
        img.src = base64Str;
    });
}

// Calcular altura dinámica de ticket en milímetros
function calculateTicketHeight(invoice, jsPDFConstructor, logoHeight = 0, branchDetails = null) {
    let height = 6; // Margen superior
    const issuer = getActiveCompanyIssuerInfo();
    const branch = branchDetails || resolvePdfBranchDetails(invoice, issuer);
    const companyEmail = issuer.companyEmail || '';
    const companyAddr = branch.branchLocation || issuer.companyAddr || '';

    const docTemp = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
    docTemp.setFont('Helvetica', 'normal');
    docTemp.setFontSize(7.5);

    // 1. Logo superior
    if (logoHeight > 0) {
        height += logoHeight + 4;
    }

    // 2. Nombre empresa + Sucursal + ubicación debajo del logo
    height += 5; // Nombre empresa
    height += 4; // Sucursal: [Nombre]
    if (branch.branchLocation) {
        const splitLoc = docTemp.splitTextToSize(`Ubicación: ${branch.branchLocation}`, 74);
        height += splitLoc.length * 3.5;
    } else if (companyAddr) {
        const splitAddr = docTemp.splitTextToSize(companyAddr, 74);
        height += splitAddr.length * 3.5;
    }
    height += 7; // RNC + Tel
    if (companyEmail) height += 3.5;
    height += 5; // Separador

    // Título y metadatos del comprobante
    height += 13;
    if (invoice.ncf) height += 4;

    // 3. Datos del cliente
    height += 18;
    if (invoice.nit) height += 3.5;
    if (invoice.address) height += 3.5;
    height += 4; // Separador

    // 4. Datos del consumo (cabecera tabla + ítems + totales)
    height += 7;
    const items = invoice.items || [];
    items.forEach(item => {
        const desc = item.desc || item.name || '--';
        const splitDesc = docTemp.splitTextToSize(desc, 40);
        const lines = Math.max(splitDesc.length, 1);
        height += Math.max(lines * 3.6, 5);
    });

    height += 5; // Separador de totales

    let totalLines = 1; // Subtotal
    if (invoice.taxRate > 0 || invoice.ncfType === 'B14') totalLines++;
    if (invoice.iscAmount > 0) totalLines++;
    if (invoice.retIsrAmount > 0) totalLines++;
    if (invoice.retItbisAmount > 0) totalLines++;
    totalLines++; // Total a Pagar
    height += totalLines * 4.2 + 2;

    if (invoice.notes) {
        const splitNotes = docTemp.splitTextToSize(`Notas: ${invoice.notes}`, 74);
        height += splitNotes.length * 3.5 + 4;
    }

    // 5. Logo final + pie de página
    height += 5; // Separador
    if (logoHeight > 0) {
        height += Math.min(logoHeight, 16) + 5;
    }
    height += 12; // Eslogan + crédito app + margen inferior

    return Math.max(height, 120);
}

function generateInvoicePDF(invoice, format = null, options = {}) {
    if (!invoice) return null;

    let determinedFormat = format;
    if (!determinedFormat) {
        if (invoice.type === 'basica') {
            determinedFormat = 'ticket'; // La factura básica es en realidad consumidor final B02
        } else if (invoice.ncfType === 'B01' || invoice.ncfType === 'B14' || invoice.ncfType === 'B15') {
            determinedFormat = 'letter';
        } else {
            // NCF B02 o Sin Comprobante van a formato Ticket
            determinedFormat = 'ticket';
        }
    }

    return proceedWithPDF(invoice, determinedFormat, options);
}

async function proceedWithPDF(invoice, format, options = {}) {
    // Normalizar factura básica de forma segura sin mutar el original (NCF opcional)
    if (invoice.type === 'basica') {
        invoice = {
            ...invoice,
            ncfType: invoice.ncfType || '',
            ncf: invoice.ncf || '',
            taxRate: (invoice.taxRate === undefined || invoice.taxRate === null || invoice.taxRate === 0) ? 18 : invoice.taxRate
        };
    }

    const jsPDFConstructor = getJsPDFConstructor();

    if (!jsPDFConstructor) {
        console.error('jsPDF NOT FOUND! Window state: ' + JSON.stringify({
            jspdf: typeof window.jspdf,
            jsPDF: typeof window.jsPDF,
            html2pdf: typeof window.html2pdf,
            html2pdf_jsPDF: window.html2pdf ? typeof window.html2pdf.jsPDF : 'undefined'
        }));
        if (typeof showToast === 'function') {
            showToast('Error: jsPDF no está cargado (ver consola)', 'error');
        }
        return;
    }

    // Configuración de empresa emisora y sucursal (sin RNC ni datos fiscales predeterminados de terceros)
    const issuer = getActiveCompanyIssuerInfo();
    const branchDetails = resolvePdfBranchDetails(invoice, issuer);
    const companyName = issuer.companyName;
    const companyLogo = issuer.companyLogo;
    const companyRNC = issuer.companyRNC;
    const companyTel = branchDetails.branchPhone || issuer.companyTel;
    const companyEmail = issuer.companyEmail;
    const companyAddr = branchDetails.branchLocation || issuer.companyAddr;

    if (!companyRNC && invoice.ncfType && typeof showToast === 'function') {
        showToast('⚠️ Configura el RNC y razón social de tu empresa en Parametrizaciones de Empresa antes de emitir comprobantes fiscales.', 'warning');
    }

    // Datos de factura
    const invoiceNum = invoice.id || '--';
    let emissionDate = invoice.date || new Date().toISOString().split('T')[0];
    const parts = emissionDate.split('-');
    const emisionFmt = parts.length === 3 ? (parts[2] + '/' + parts[1] + '/' + parts[0]) : emissionDate;

    const clientName = invoice.company || invoice.client || 'CONSUMIDOR FINAL';
    const clientRNC  = invoice.nit     || '--';
    const clientAddr = invoice.address || '--';
    const clientContact = invoice.contact || '--';

    const items    = invoice.items || [];
    const taxRate  = parseFloat(invoice.taxRate) || 0;

    const isBasica = format === 'basica';
    const isLetter = format === 'letter' || isBasica;
    const isTicket = format === 'ticket';

    const logoBox = await _computePdfLogoDimensions(companyLogo, isTicket ? 24 : 36, isTicket ? 20 : 18);
    const computedLogoWidth = logoBox.width;
    const computedLogoHeight = logoBox.height;
    const logoFormat = logoBox.format;

    let doc;
    if (isTicket) {
        // === FORMATO TICKET (POS 80mm) ===
        // Orden obligatorio: Logo -> Nombre empresa + Sucursal/ubicación -> Datos cliente -> Datos consumo -> Logo final
        const pageHeight = calculateTicketHeight(invoice, jsPDFConstructor, computedLogoHeight, branchDetails);
        doc = new jsPDFConstructor({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, pageHeight]
        });

        let y = 5;

        // 1. Logo arriba centrado
        if (computedLogoHeight > 0) {
            try {
                const logoX = (80 - computedLogoWidth) / 2;
                doc.addImage(companyLogo, logoFormat, logoX, y, computedLogoWidth, computedLogoHeight);
                y += computedLogoHeight + 4;
            } catch (e) {
                console.error("Error drawing logo in ticket:", e);
            }
        }

        // 2. Debajo del logo: Nombre de la empresa + Sucursal + ubicación de sucursal
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(companyName, 40, y, { align: 'center' });
        y += 4;

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text(`Sucursal: ${branchDetails.branchName}`, 40, y, { align: 'center' });
        y += 3.8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        if (branchDetails.branchLocation) {
            const locLines = doc.splitTextToSize(`Ubicación: ${branchDetails.branchLocation}`, 74);
            locLines.forEach(l => {
                doc.text(l, 40, y, { align: 'center' });
                y += 3.4;
            });
        }

        doc.text(`RNC: ${companyRNC || 'Sin configurar'}`, 40, y, { align: 'center' });
        y += 3.4;
        if (companyTel) {
            doc.text(`Tel: ${companyTel}`, 40, y, { align: 'center' });
            y += 3.4;
        }
        if (companyEmail) {
            doc.text(`Email: ${companyEmail}`, 40, y, { align: 'center' });
            y += 3.4;
        }

        // Separador punteado
        y += 1.5;
        doc.setLineWidth(0.15);
        doc.setDrawColor(150, 150, 150);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(2, y, 78, y);
        doc.setLineDashPattern([], 0);
        y += 4;

        // Título del documento y metadatos
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        let ticketTitle = "FACTURA SIN COMPROBANTE FISCAL";
        if (invoice.notes && invoice.notes.toUpperCase().includes("COTIZACION")) {
            ticketTitle = "COTIZACIÓN";
        } else if (invoice.type === 'basica') {
            ticketTitle = "BITÁCORA DE RECOGIDA / FACTURA BÁSICA";
        } else if (invoice.ncfType === 'B02') {
            ticketTitle = "FACTURA DE CONSUMIDOR FINAL";
        } else if (invoice.ncfType === 'B01') {
            ticketTitle = "FACTURA DE CRÉDITO FISCAL";
        } else if (invoice.ncfType === 'B14') {
            ticketTitle = "RÉGIMEN ESPECIAL";
        } else if (invoice.ncfType === 'B15') {
            ticketTitle = "COMPROBANTE GUBERNAMENTAL";
        } else if (invoice.ncf && invoice.typeName) {
            ticketTitle = (invoice.typeName.toLowerCase() === 'empresarial')
                ? "FACTURA DE CRÉDITO FISCAL"
                : invoice.typeName.toUpperCase();
        }
        doc.setTextColor(15, 23, 42);
        doc.text(ticketTitle, 40, y, { align: 'center' });
        y += 4.2;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Factura: ${invoiceNum.replace('RICI ', '')}`, 2, y);
        doc.text(`Fecha: ${emisionFmt}`, 78, y, { align: 'right' });
        y += 3.5;

        if (invoice.ncf) {
            doc.setFont('Helvetica', 'bold');
            doc.text(`NCF: ${invoice.ncf}`, 2, y);
            const dueFmt = _resolveInvoiceNcfDueDateFormatted(invoice);
            if (dueFmt) {
                doc.setFont('Helvetica', 'normal');
                doc.text(`Vence: ${dueFmt}`, 78, y, { align: 'right' });
            }
            y += 3.5;
        }

        // 3. Debajo: Datos del cliente
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text("DATOS DEL CLIENTE", 2, y);
        y += 3.5;
        doc.setFont('Helvetica', 'normal');
        const displayClient = (clientName && clientName !== '--') ? clientName : "Cliente al Contado";
        doc.text(`Cliente: ${displayClient}`, 2, y);
        y += 3.4;
        if (clientRNC && clientRNC !== '--') {
            doc.text(`RNC/Cédula: ${clientRNC}`, 2, y);
            y += 3.4;
        }
        if (clientAddr && clientAddr !== '--') {
            const cAddrLines = doc.splitTextToSize(`Dir: ${clientAddr}`, 74);
            cAddrLines.slice(0, 2).forEach(line => {
                doc.text(line, 2, y);
                y += 3.2;
            });
        }

        const payDisplay = invoice.payMethod || invoice.paymentMethod || 'Efectivo';
        doc.text(`Pago: ${payDisplay}`, 2, y);
        if (invoice.collaborator) {
            doc.text(`Colab: ${invoice.collaborator}`, 78, y, { align: 'right' });
        }
        y += 4;

        // Separador punteado -> 4. Datos del consumo
        doc.setLineDashPattern([1, 1], 0);
        doc.line(2, y, 78, y);
        doc.setLineDashPattern([], 0);
        y += 3.5;

        // Cabecera tabla de consumo
        doc.setFont('Helvetica', 'bold');
        doc.text("Cant", 2, y);
        doc.text("Consumo / Descripción", 12, y);
        doc.text("Precio", 60, y, { align: 'right' });
        doc.text("Importe", 78, y, { align: 'right' });
        y += 2.5;

        doc.setLineWidth(0.1);
        doc.line(2, y, 78, y);
        y += 4;

        // Ítems
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        
        let subtotal = 0;
        let totalITBIS = 0;

        items.forEach((item) => {
            const qty = parseFloat(item.qty) || 0;
            const uprice = parseFloat(item.uprice || item.priceSell || item.price || 0) || 0;
            const valor = qty * uprice;
            
            subtotal += valor;
            
            // ITBIS
            let itemTax = 0;
            if (invoice.ncfType !== 'B14') {
                itemTax = valor * (taxRate / 100);
            }
            totalITBIS += itemTax;

            let desc = item.desc || item.name || '--';
            const splitDesc = doc.splitTextToSize(desc, 42); // 42mm de ancho para descripción

            // Primera línea
            doc.text(String(qty), 2, y);
            doc.text(splitDesc[0], 12, y);
            doc.text(safeFormatMoney(uprice).replace('RD$', '').trim(), 60, y, { align: 'right' });
            doc.text(safeFormatMoney(valor).replace('RD$', '').trim(), 78, y, { align: 'right' });
            
            // Líneas adicionales si el texto es largo
            if (splitDesc.length > 1) {
                for (let i = 1; i < splitDesc.length; i++) {
                    y += 3.5;
                    doc.text(splitDesc[i], 12, y);
                }
            }
            y += 4.5;
        });

        // Separador antes de totales
        y -= 1;
        doc.setLineWidth(0.1);
        doc.line(2, y, 78, y);
        y += 4.5;

        // Totales
        doc.setFont('Helvetica', 'normal');
        doc.text("Sub-Total:", 45, y);
        doc.text(safeFormatMoney(subtotal), 78, y, { align: 'right' });
        y += 4;

        // ITBIS desglosado
        if (invoice.ncfType === 'B14') {
            doc.text("ITBIS (0%):", 45, y);
            doc.text("RD$ 0.00", 78, y, { align: 'right' });
            y += 4;
        } else if (taxRate > 0) {
            doc.text(`ITBIS (${taxRate}%):`, 45, y);
            doc.text(safeFormatMoney(totalITBIS), 78, y, { align: 'right' });
            y += 4;
        }

        // ISC
        if (invoice.iscAmount > 0) {
            doc.text(`ISC (${invoice.iscRate}%):`, 45, y);
            doc.text(`+${safeFormatMoney(invoice.iscAmount)}`, 78, y, { align: 'right' });
            y += 4;
        }

        // Retenciones
        if (invoice.retIsrAmount > 0 && invoice.ncfType !== 'B14') {
            doc.text(`Ret. ISR (${invoice.retIsrRate}%):`, 45, y);
            doc.text(`-${safeFormatMoney(invoice.retIsrAmount)}`, 78, y, { align: 'right' });
            y += 4;
        }
        if (invoice.retItbisAmount > 0 && invoice.ncfType !== 'B14') {
            doc.text(`Ret. ITBIS (${invoice.retItbisRate}%):`, 45, y);
            doc.text(`-${safeFormatMoney(invoice.retItbisAmount)}`, 78, y, { align: 'right' });
            y += 4;
        }

        // Total Neto a Pagar
        const total = subtotal + (invoice.iscAmount || 0) + totalITBIS - (invoice.retIsrAmount || 0) - (invoice.retItbisAmount || 0);
        doc.setFont('Helvetica', 'bold');
        doc.text("Total a Pagar:", 45, y);
        doc.text(safeFormatMoney(total), 78, y, { align: 'right' });
        y += 6;

        // Notas
        if (invoice.notes) {
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            const notesLines = doc.splitTextToSize(`Notas: ${invoice.notes}`, 74);
            notesLines.forEach(l => {
                doc.text(l, 2, y);
                y += 3.2;
            });
            y += 2;
        }

        // 5. Logo al final del ticket + pie de página
        y += 1;
        doc.setLineWidth(0.1);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(2, y, 78, y);
        doc.setLineDashPattern([], 0);
        y += 4;

        if (computedLogoHeight > 0 && companyLogo) {
            try {
                const footH = Math.min(computedLogoHeight, 15);
                const aspect = computedLogoHeight > 0 ? (computedLogoWidth / computedLogoHeight) : 1.5;
                const footW = footH * aspect;
                const footX = (80 - footW) / 2;
                doc.addImage(companyLogo, logoFormat, footX, y, footW, footH);
                y += footH + 3.5;
            } catch (_) {}
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.0);
        doc.setTextColor(30, 41, 59);
        doc.text("un respiro al planeta, un residuo a la vez", 40, y, { align: 'center' });
        y += 4;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(140, 140, 140);
        doc.text("hecho con reciminsaapp: un respiro al planeta, un residuo a la vez", 40, y, { align: 'center' });

    } else {
        // === FORMATO CORPORATIVO (CARTA / LETTER) ===
        // Orden obligatorio: Logo arriba -> Debajo Nombre Empresa + Sucursal + ubicación -> Debajo Datos Cliente -> Luego Datos Consumo -> Por último Logo
        doc = new jsPDFConstructor({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        });

        const accentColor = isBasica ? [59, 130, 246] : [22, 163, 74];
        let y = 12;

        // 1. Cabecera - Logo arriba
        let logoHeightToUse = 0;
        if (computedLogoHeight > 0 && companyLogo) {
            try {
                doc.addImage(companyLogo, logoFormat, 15, y, computedLogoWidth, computedLogoHeight);
                logoHeightToUse = computedLogoHeight;
            } catch (e) {
                console.error("Error drawing logo in letter PDF:", e);
                logoHeightToUse = 0;
            }
        }

        // 2. Debajo del logo: Nombre de la empresa + Sucursal + ubicación de sucursal
        let emisorTextY = y + (logoHeightToUse > 0 ? logoHeightToUse + 5 : 5);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(companyName, 15, emisorTextY);
        emisorTextY += 4.5;

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(`Sucursal: ${branchDetails.branchName}`, 15, emisorTextY);
        emisorTextY += 4.2;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        if (branchDetails.branchLocation) {
            const locLines = doc.splitTextToSize(`Ubicación: ${branchDetails.branchLocation}`, 98);
            locLines.forEach(l => {
                doc.text(l, 15, emisorTextY);
                emisorTextY += 3.8;
            });
        }

        doc.text(`RNC: ${companyRNC || 'Sin configurar'}`, 15, emisorTextY);
        emisorTextY += 3.8;
        if (companyTel) {
            doc.text(`Tel: ${companyTel}`, 15, emisorTextY);
            emisorTextY += 3.8;
        }
        if (companyEmail) {
            doc.text(`Email: ${companyEmail}`, 15, emisorTextY);
            emisorTextY += 3.8;
        }

        // Bloque del Comprobante (Ficha Derecha Destacada)
        let blockTitle = (!invoice.ncf && !invoice.ncfType)
            ? "FACTURA SIN COMPROBANTE FISCAL"
            : "FACTURA DE CRÉDITO FISCAL";
        if (isBasica) {
            blockTitle = "FACTURA BÁSICA / BITÁCORA";
        } else if (invoice.ncfType === 'B01') {
            blockTitle = "FACTURA DE CRÉDITO FISCAL";
        } else if (invoice.ncfType === 'B14') {
            blockTitle = "FACTURA DE RÉGIMEN ESPECIAL";
        } else if (invoice.ncfType === 'B15') {
            blockTitle = "FACTURA GUBERNAMENTAL";
        } else if (invoice.ncfType === 'B02') {
            blockTitle = "FACTURA DE CONSUMIDOR FINAL";
        } else if (invoice.ncf && invoice.typeName) {
            blockTitle = (invoice.typeName.toLowerCase() === 'empresarial')
                ? "FACTURA DE CRÉDITO FISCAL"
                : invoice.typeName.toUpperCase();
        }

        // Tarjeta para metadatos del NCF
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(125, y, 75.9, 36, 1.5, 1.5, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(blockTitle, 162.95, y + 5, { align: 'center' });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(125, y + 8, 200.9, y + 8);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        let dataY = y + 13;
        doc.setFont('Helvetica', 'bold');
        doc.text(`Factura No:`, 128, dataY);
        doc.setFont('Helvetica', 'normal');
        doc.text(invoiceNum.replace('RICI ', ''), 155, dataY);
        dataY += 4.2;

        if (invoice.ncf) {
            doc.setFont('Helvetica', 'bold');
            doc.text(`NCF:`, 128, dataY);
            doc.text(invoice.ncf, 155, dataY);
            dataY += 4.2;

            const dueFmt = _resolveInvoiceNcfDueDateFormatted(invoice);
            if (dueFmt) {
                doc.setFont('Helvetica', 'bold');
                doc.text(`Vence:`, 128, dataY);
                doc.setFont('Helvetica', 'normal');
                doc.text(dueFmt, 155, dataY);
                dataY += 4.2;
            }
        }

        doc.setFont('Helvetica', 'bold');
        doc.text(`Fecha:`, 128, dataY);
        doc.setFont('Helvetica', 'normal');
        doc.text(emisionFmt, 155, dataY);
        dataY += 4.2;

        doc.text(`Sucursal:`, 128, dataY);
        doc.text(String(branchDetails.branchName || '').slice(0, 24), 155, dataY);

        // 3. Debajo: Sección del Cliente
        y = Math.max(emisorTextY + 3, y + 40);
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.25);
        doc.roundedRect(15, y, 185.9, 25, 1, 1, 'FD');

        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(15, y, 1.5, 25, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);

        let clientLabel = "DATOS DEL CLIENTE";
        if (isBasica) {
            clientLabel = "DATOS DEL CLIENTE / PROVEEDOR";
        } else if (invoice.ncfType === 'B15') {
            clientLabel = "DATOS DEL CLIENTE (INSTITUCIÓN DEL ESTADO)";
        }
        doc.text(clientLabel, 19, y + 4.5);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(clientName, 19, y + 9.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        doc.text(`RNC/Cédula: ${clientRNC}`, 19, y + 14.5);
        doc.text(`Contacto: ${clientContact}`, 19, y + 19.5);

        doc.text(`Dirección: ${clientAddr}`, 115, y + 14.5);
        const letterPay = invoice.payMethod || invoice.paymentMethod || 'Efectivo';
        const letterColab = invoice.collaborator ? `  |  Vendedor: ${invoice.collaborator}` : '';
        doc.text(`Pago: ${letterPay}${letterColab}`, 115, y + 19.5);

        // 4. Luego: Datos del Consumo (Tabla de Artículos)
        y += 29;
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(15, y, 185.9, 7.5, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        
        if (isBasica) {
            doc.text("Descripción", 17, y + 5);
            doc.text("Cantidad", 115, y + 5);
            doc.text("P. Unitario", 150, y + 5);
            doc.text("Total", 199, y + 5, { align: 'right' });
        } else {
            doc.text("Cant", 17, y + 5);
            doc.text("Descripción del Producto / Servicio", 35, y + 5);
            doc.text("Precio Unitario", 155, y + 5, { align: 'right' });
            doc.text("Importe", 199, y + 5, { align: 'right' });
        }

        y += 7.5;

        let subtotal = 0;
        let totalITBIS = 0;

        // Paginación corporativa
        const checkPageBreakLetter = (lineHeight) => {
            if (y + lineHeight > 240) {
                doc.addPage();
                
                // Dibujar cabecera de tabla de nuevo en la siguiente página
                y = 20;
                doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.rect(15, y, 185.9, 7.5, 'F');

                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(255, 255, 255);

                if (isBasica) {
                    doc.text("Descripción", 17, y + 5);
                    doc.text("Cantidad", 115, y + 5);
                    doc.text("P. Unitario", 150, y + 5);
                    doc.text("Total", 199, y + 5, { align: 'right' });
                } else {
                    doc.text("Cant", 17, y + 5);
                    doc.text("Descripción del Producto / Servicio", 35, y + 5);
                    doc.text("Precio Unitario", 155, y + 5, { align: 'right' });
                    doc.text("Importe", 199, y + 5, { align: 'right' });
                }

                y += 7.5;
            }
        };

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);

        items.forEach((item, idx) => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.uprice || item.priceBuy || item.price || 0) || 0;
            const valor = qty * price;

            subtotal += valor;
            
            let itemTax = 0;
            if (!isBasica && invoice.ncfType !== 'B14') {
                itemTax = valor * (taxRate / 100);
            }
            totalITBIS += itemTax;

            let desc = item.desc || item.name || '--';
            const splitDesc = doc.splitTextToSize(desc, isBasica ? 90 : 110);
            const rowHeight = Math.max(splitDesc.length * 4.5 + 2.5, 7.5);

            checkPageBreakLetter(rowHeight);

            // Fondo alternado para filas
            if (idx % 2 === 1) {
                doc.setFillColor(250, 250, 250);
                doc.rect(15, y, 185.9, rowHeight, 'F');
            }

            // Borde inferior
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.15);
            doc.line(15, y + rowHeight, 200.9, y + rowHeight);

            // Rellenar celdas
            if (isBasica) {
                doc.text(splitDesc, 17, y + 4.8);
                doc.text(`${qty} ${item.unit || ''}`, 115, y + 4.8);
                doc.text(safeFormatMoney(price).replace('RD$', '').trim(), 150, y + 4.8);
                
                doc.setFont('Helvetica', 'bold');
                doc.text(safeFormatMoney(valor).replace('RD$', '').trim(), 199, y + 4.8, { align: 'right' });
                doc.setFont('Helvetica', 'normal');
            } else {
                doc.text(String(qty), 17, y + 4.8);
                doc.text(splitDesc, 35, y + 4.8);
                doc.text(safeFormatMoney(price).replace('RD$', '').trim(), 155, y + 4.8, { align: 'right' });
                
                doc.setFont('Helvetica', 'bold');
                doc.text(safeFormatMoney(valor).replace('RD$', '').trim(), 199, y + 4.8, { align: 'right' });
                doc.setFont('Helvetica', 'normal');
            }

            y += rowHeight;
        });

        // Asegurar que la firma y los totales no queden huérfanos
        const spacingNeeded = isBasica ? 35 : 55;
        if (y + spacingNeeded > 245) {
            doc.addPage();
            y = 20;
        }

        // Totales y Notas
        y += 5;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(15, y, 200.9, y);

        y += 5;
        
        // Bloque de Totales
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        let totalRowY = y;
        
        if (isBasica) {
            doc.text("Total Compra:", 145, totalRowY);
            doc.setTextColor(239, 68, 68);
            doc.text(`-${safeFormatMoney(subtotal)}`, 199, totalRowY, { align: 'right' });
            
            totalRowY += 5.5;
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.text("Balance Neto:", 145, totalRowY);
            
            const bal = parseFloat(invoice.balance) || 0;
            const balColor = bal >= 0 ? [59, 130, 246] : [239, 68, 68];
            doc.setTextColor(balColor[0], balColor[1], balColor[2]);
            doc.text(safeFormatMoney(bal), 199, totalRowY, { align: 'right' });
        } else {
            doc.text("Sub-Total:", 145, totalRowY);
            doc.setTextColor(30, 41, 59);
            doc.text(safeFormatMoney(subtotal), 199, totalRowY, { align: 'right' });
            
            if (invoice.ncfType === 'B14') {
                totalRowY += 4.5;
                doc.setTextColor(71, 85, 105);
                doc.text("ITBIS (0%):", 145, totalRowY);
                doc.setTextColor(30, 41, 59);
                doc.text("RD$ 0.00", 199, totalRowY, { align: 'right' });
            } else if (taxRate > 0) {
                totalRowY += 4.5;
                doc.setTextColor(71, 85, 105);
                doc.text(`ITBIS (${taxRate}%):`, 145, totalRowY);
                doc.setTextColor(30, 41, 59);
                doc.text(safeFormatMoney(totalITBIS), 199, totalRowY, { align: 'right' });
            }
            
            // Retenciones/Otros
            if (invoice.ncfType !== 'B14') {
                if (invoice.retIsrAmount > 0) {
                    totalRowY += 4.5;
                    doc.setTextColor(71, 85, 105);
                    doc.text(`Retención ISR (${invoice.retIsrRate}%):`, 145, totalRowY);
                    doc.setTextColor(239, 68, 68);
                    doc.text(`-${safeFormatMoney(invoice.retIsrAmount)}`, 199, totalRowY, { align: 'right' });
                }
                if (invoice.retItbisAmount > 0) {
                    totalRowY += 4.5;
                    doc.setTextColor(71, 85, 105);
                    doc.text(`Retención ITBIS (${invoice.retItbisRate}%):`, 145, totalRowY);
                    doc.setTextColor(239, 68, 68);
                    doc.text(`-${safeFormatMoney(invoice.retItbisAmount)}`, 199, totalRowY, { align: 'right' });
                }
            }
            
            if (invoice.iscAmount > 0) {
                totalRowY += 4.5;
                doc.setTextColor(71, 85, 105);
                doc.text(`ISC (${invoice.iscRate}%):`, 145, totalRowY);
                doc.setTextColor(30, 41, 59);
                doc.text(`+${safeFormatMoney(invoice.iscAmount)}`, 199, totalRowY, { align: 'right' });
            }

            // Total Neto a Pagar
            const total = subtotal + (invoice.iscAmount || 0) + totalITBIS - (invoice.retIsrAmount || 0) - (invoice.retItbisAmount || 0);
            totalRowY += 5.5;
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.text("Total a Pagar:", 145, totalRowY);
            doc.text(safeFormatMoney(total), 199, totalRowY, { align: 'right' });
        }

        // Notas (Lado Izquierdo)
        if (invoice.notes) {
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const notesLines = doc.splitTextToSize(`Notas: ${invoice.notes}`, 120);
            
            let noteYOffset = y;
            notesLines.forEach(l => {
                doc.text(l, 15, noteYOffset);
                noteYOffset += 4;
            });
        }

        // Firmas (Exclusivo de Facturas de Crédito Fiscal, Régimen Especial, Gubernamental o Básicas)
        // Las facturas de Consumidor Final (B02) NO llevan firma
        let endContentY = Math.max(totalRowY + 6, y + 10);
        if (invoice.ncfType !== 'B02') {
            let sigY = Math.max(totalRowY + 15, y + 20);
            if (sigY > 240) {
                doc.addPage();
                sigY = 35;
            }

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.35);

            // Gerente de Turno
            doc.line(30, sigY, 90, sigY);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            doc.text("Gerente de Turno", 60, sigY + 5, { align: 'center' });

            // Recibido Conforme
            doc.line(125, sigY, 185, sigY);
            doc.text("Recibido Conforme", 155, sigY + 5, { align: 'center' });
            endContentY = sigY + 10;
        }

        // 5. Por último: Logo de la empresa al final del documento
        if (logoBox.hasLogo && companyLogo) {
            const footLogoH = Math.min(logoBox.height || 14, 15);
            const aspect = (logoBox.height > 0) ? (logoBox.width / logoBox.height) : 1.5;
            const footLogoW = footLogoH * aspect;
            let footLogoY = Math.max(endContentY + 6, 240);
            if (footLogoY + footLogoH > 262) {
                doc.addPage();
                footLogoY = 30;
            }
            try {
                doc.addImage(companyLogo, logoFormat, (215.9 - footLogoW) / 2, footLogoY, footLogoW, footLogoH);
            } catch (_) {}
        }

        // Numeración y Pie de página en todas las páginas corporativas
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);

            doc.setFont('Helvetica', 'bold');
            doc.text("un respiro al planeta, un residuo a la vez", 107.95, 267, { align: 'center' });

            doc.setFontSize(7.5);
            doc.setTextColor(150, 150, 150);
            doc.text("hecho con reciminsaapp: un respiro al planeta, un residuo a la vez", 107.95, 272, { align: 'center' });

            doc.text(
                `Página ${i} de ${totalPages}`, 
                200.9, 
                272, 
                { align: 'right' }
            );
        }
    }

    // === ENVIAR O DESCARGAR EL PDF GENERADO ===
    if (!(options && options.returnResult) && typeof showToast === 'function') {
        showToast('Generando y procesando PDF...', 'info');
    }

    const pdfBase64 = doc.output('datauristring');
    const base64Data = pdfBase64.split(',')[1];

    if (options && options.returnResult === true) {
        return {
            filename: `Factura_${invoice.id}.pdf`,
            base64Data,
            blob: base64ToBlob(base64Data, 'application/pdf')
        };
    }

    // --- PUENTE NATIVO MOBILE (Capacitor) ---
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.Plugins) {
        const { Filesystem, Share } = Capacitor.Plugins;
        if (Filesystem && Share) {
            try {
                if (typeof showToast === 'function') {
                    showToast('Generando archivo local...', 'info');
                }
                Filesystem.writeFile({
                    path: `Factura_${invoice.id}.pdf`,
                    data: base64Data,
                    directory: 'CACHE'
                }).then((res) => {
                    if (typeof showToast === 'function') {
                        showToast('📄 PDF generado con éxito', 'success');
                    }
                    Share.share({
                        title: `Factura_${invoice.id}.pdf`,
                        url: res.uri
                    }).catch(shareErr => {
                        console.error('Error al compartir PDF:', shareErr);
                    });
                }).catch(fileErr => {
                    console.error('Error al escribir archivo PDF:', fileErr);
                    if (typeof showToast === 'function') {
                        showToast('❌ Error al escribir archivo PDF local: ' + fileErr.message, 'error');
                    }
                });
                return;
            } catch (capErr) {
                console.warn('Error en Capacitor, intentando fallback de descarga...', capErr);
            }
        }
    }

    // --- PUENTE NATIVO DESKTOP (Electron IPC) ---
    if (window.electronAPI && typeof window.electronAPI.savePDF === 'function') {
        try {
            window.electronAPI.savePDF(base64Data, `Factura_${invoice.id}.pdf`);
            if (typeof showToast === 'function') {
                showToast('📄 Abriendo diálogo para guardar PDF...', 'success');
            }
            return;
        } catch (elecErr) {
            console.warn('Electron savePDF error, continuando con descarga...', elecErr);
        }
    }

    // --- PUENTE NATIVO ANDROID (MAUI BlazorWebView) ---
    if (window.AndroidNative && typeof window.AndroidNative.DownloadFile === 'function') {
        try {
            window.AndroidNative.DownloadFile(`Factura_${invoice.id}.pdf`, base64Data);
            if (typeof showToast === 'function') {
                showToast('📄 Factura guardada en Descargas', 'success');
            }
            return;
        } catch (androidErr) {
            console.warn('Android native bridge error, continuando...', androidErr);
        }
    }

    // --- PUENTE NATIVO .NET MAUI (HybridWebView SendRawMessage en Android y Windows) ---
    if (window.NativeBridge && typeof window.NativeBridge.post === 'function') {
        try {
            const posted = NativeBridge.post({
                action: 'download',
                filename: `Factura_${invoice.id}.pdf`,
                data: base64Data
            });
            if (posted) {
                if (typeof showToast === 'function') {
                    showToast('📄 Factura guardada en Descargas', 'success');
                }
                return;
            }
        } catch (bridgeErr) {
            console.warn('NativeBridge error, continuando con descarga...', bridgeErr);
        }
    }

    // --- NAVEGADORES WEB ESTÁNDAR ---
    try {
        doc.save(`Factura_${invoice.id}.pdf`);
        if (typeof showToast === 'function') {
            showToast('📄 Factura descargada con éxito', 'success');
        }
        return;
    } catch (saveErr) {
        console.warn('Error con doc.save, intentando fallback de subida...', saveErr);
    }

    // Subir y abrir en navegador (Fallback secundario si falla doc.save)
    try {
        const blob = base64ToBlob(base64Data, 'application/pdf');
        const formData = new FormData();
        formData.append('file', blob, `Factura_${invoice.id}.pdf`);

        fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => {
            if (!res.ok) throw new Error('Upload failed');
            return res.json();
        })
        .then(data => {
            if (data.status === 'success' && data.data && data.data.url) {
                const downloadUrl = data.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
                if (typeof showToast === 'function') {
                    showToast('📄 Abriendo PDF en el navegador...', 'success');
                }
                if (typeof window.openExternalLink === 'function') {
                    window.openExternalLink(downloadUrl);
                } else {
                    window.open(downloadUrl, '_blank');
                }
            } else {
                throw new Error('Invalid response');
            }
        })
        .catch(uploadErr => {
            console.error('Error uploading PDF, falling back to local download:', uploadErr);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Factura_${invoice.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        });
    } catch (err) {
        console.error('PDF native generation crash:', err);
        if (typeof showToast === 'function') {
            showToast('❌ Error al procesar PDF: ' + err.message, 'error');
        }
    }
}

// =============================================
// MOTOR DE ENTREGA UNIVERSAL DE PDF
// =============================================
async function deliverGenericPDF(doc, filename, label = 'Documento') {
    const base64Data = doc.output('datauristring').split(',')[1];

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
        try {
            const { Filesystem } = window.Capacitor.Plugins;
            await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: 'DOCUMENTS',
                recursive: true
            });
            if (window.Capacitor.Plugins.Share) {
                const uriRes = await Filesystem.getUri({ path: filename, directory: 'DOCUMENTS' });
                await window.Capacitor.Plugins.Share.share({
                    title: filename,
                    url: uriRes.uri,
                    dialogTitle: `Compartir ${label}`
                });
            } else if (typeof showToast === 'function') {
                showToast(`📄 ${label} guardado en Documentos`, 'success');
            }
            return;
        } catch (capErr) {
            console.warn('Capacitor error:', capErr);
        }
    }

    if (window.electronAPI && typeof window.electronAPI.savePDF === 'function') {
        try {
            window.electronAPI.savePDF(base64Data, filename);
            if (typeof showToast === 'function') showToast(`📄 Guardando ${label}...`, 'success');
            return;
        } catch (_) {}
    }

    // --- PUENTE NATIVO ANDROID (MAUI HybridWebView) ---
    if (window.AndroidNative && typeof window.AndroidNative.DownloadFile === 'function') {
        try {
            window.AndroidNative.DownloadFile(filename, base64Data);
            if (typeof showToast === 'function') {
                showToast(`📄 ${label} guardado en Descargas`, 'success');
            }
            return;
        } catch (androidErr) {
            console.warn('Android native bridge error:', androidErr);
        }
    }

    // --- PUENTE NATIVO .NET MAUI (HybridWebView SendRawMessage en Android y Windows) ---
    if (window.NativeBridge && typeof window.NativeBridge.post === 'function') {
        try {
            const posted = NativeBridge.post({ action: 'download', filename, data: base64Data });
            if (posted) {
                if (typeof showToast === 'function') showToast(`📄 ${label} guardado en Descargas`, 'success');
                return;
            }
        } catch (bridgeErr) {
            console.warn('NativeBridge error:', bridgeErr);
        }
    }

    try {
        doc.save(filename);
        if (typeof showToast === 'function') showToast(`📄 ${label} descargado con éxito`, 'success');
        return;
    } catch (_) {
        const blob = base64ToBlob(base64Data, 'application/pdf');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

// =============================================
// HELPERS COMUNES PARA CABECERA Y PIE DE LOGO
// =============================================
async function _preparePdfBranding(docObj) {
    const issuer = getActiveCompanyIssuerInfo();
    const branch = resolvePdfBranchDetails(docObj, issuer);
    const logoBox = await _computePdfLogoDimensions(issuer.companyLogo, 36, 18);
    return { issuer, branch, logoBox };
}

/**
 * Dibuja cabecera estándar:
 * 1. Logo arriba (izq) + Tarjeta derecha (opcional)
 * 2. Debajo del logo: Nombre de la empresa + Sucursal + Ubicación de sucursal + RNC/Tel/Email
 */
function _drawStandardIssuerBlock(doc, branding, startY, accentRgb = [22, 163, 74], leftX = 15, rightCardTopLimitY = 0) {
    const { issuer, branch, logoBox } = branding;
    let y = startY;

    if (logoBox.hasLogo && issuer.companyLogo) {
        try {
            doc.addImage(issuer.companyLogo, logoBox.format, leftX, y, logoBox.width, logoBox.height);
            y += logoBox.height + 5;
        } catch (_) {
            y += 2;
        }
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(issuer.companyName, leftX, y);
    y += 4.6;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.text(`Sucursal: ${branch.branchName}`, leftX, y);
    y += 4.2;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    if (branch.branchLocation) {
        const locLines = doc.splitTextToSize(`Ubicación: ${branch.branchLocation}`, 98);
        locLines.forEach(l => {
            doc.text(l, leftX, y);
            y += 3.8;
        });
    }

    const rncTel = [];
    rncTel.push(`RNC: ${issuer.companyRNC || 'Sin configurar'}`);
    if (branch.branchPhone || issuer.companyTel) {
        rncTel.push(`Tel: ${branch.branchPhone || issuer.companyTel}`);
    }
    doc.text(rncTel.join('  |  '), leftX, y);
    y += 3.8;

    if (issuer.companyEmail) {
        doc.text(`Email: ${issuer.companyEmail}`, leftX, y);
        y += 3.8;
    }

    if (issuer.companySlogan) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text(issuer.companySlogan, leftX, y);
        y += 4;
    }

    return Math.max(y + 3, rightCardTopLimitY);
}

/**
 * Dibuja por último el logo de la empresa centrado al pie del documento.
 */
function _drawEndDocumentLogo(doc, branding, afterContentY, minY = 238, maxBottomY = 262) {
    const { issuer, logoBox } = branding;
    if (!logoBox || !logoBox.hasLogo || !issuer.companyLogo) return afterContentY;
    const aspect = (logoBox.height > 0) ? (logoBox.width / logoBox.height) : 1.5;
    const drawH = Math.min(logoBox.height || 14, 15);
    const drawW = drawH * aspect;
    let targetY = Math.max(afterContentY + 6, minY);
    if (targetY + drawH > maxBottomY) {
        doc.addPage();
        targetY = 30;
    }
    try {
        doc.addImage(issuer.companyLogo, logoBox.format, (215.9 - drawW) / 2, targetY, drawW, drawH);
        return targetY + drawH;
    } catch (_) {
        return afterContentY;
    }
}

// =============================================
// PDF: COTIZACIÓN / PRESUPUESTO (MODELO OFICIAL RECIMINSA)
// =============================================
async function generateQuotePDF(quote, options = {}) {
    if (!quote) return null;
    const jsPDFConstructor = getJsPDFConstructor();
    if (!jsPDFConstructor) {
        showToast('Error: jsPDF no está cargado', 'error');
        return null;
    }

    const doc = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = 215.9;
    const pageCenter = pageWidth / 2; // 107.95 mm

    function formatSpanishDate(dateInput) {
        if (!dateInput) {
            const now = new Date();
            const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        }
        let d;
        if (typeof dateInput === 'string' && dateInput.includes('-')) {
            const parts = dateInput.split('T')[0].split('-');
            if (parts.length === 3) {
                d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        } else if (typeof dateInput === 'string' && dateInput.includes('/')) {
            const parts = dateInput.split('/');
            if (parts.length === 3) {
                d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
        }
        if (!d || isNaN(d.getTime())) d = new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    function formatNum(val) {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // 1. Logo arriba + Fecha/Cotización arriba a la derecha
    const branding = await _preparePdfBranding(quote);
    const { issuer, branch } = branding;
    const companyRNC = issuer.companyRNC;
    const companyTel = branch.branchPhone || issuer.companyTel;
    const companyEmail = issuer.companyEmail;
    const companySlogan = issuer.companySlogan;

    // Ficha derecha superior: Cotización No. y Fecha
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(130, 12, 64, 24, 1.5, 1.5, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(22, 163, 74);
    doc.text('COTIZACIÓN', 162, 19, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 41, 55);
    doc.text(`No.: ${quote.id || '--'}`, 134, 25.5);
    doc.text(`Fecha: ${formatSpanishDate(quote.date)}`, 134, 30.5);
    doc.text(`Validez: ${quote.validityDays || 15} días`, 134, 34.5);

    // 2. Logo + Debajo Nombre de empresa + Sucursal + ubicación de sucursal
    let y = _drawStandardIssuerBlock(doc, branding, 12, [22, 163, 74], 22, 42);

    // 3. Debajo: Datos del Cliente (Recuadro limpio)
    const clientName = quote.client || quote.clientName || 'Cliente General';
    let clientAddress = quote.address || quote.direccion || '';
    let clientNit = quote.nit || quote.rnc || '';
    let clientContact = quote.contact || quote.telefono || '';

    if ((!clientAddress || !clientNit || !clientContact) && clientName) {
        try {
            const clients = (typeof getClients === 'function')
                ? getClients(quote.branchId || null)
                : JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
            const found = clients.find(c =>
                (c.name && c.name.trim().toLowerCase() === clientName.trim().toLowerCase()) ||
                (clientNit && c.nit && c.nit.trim() === clientNit.trim())
            );
            if (found) {
                if (!clientAddress) clientAddress = found.address || found.direccion || '';
                if (!clientNit) clientNit = found.nit || '';
                if (!clientContact) clientContact = found.contact || found.phone || '';
            }
        } catch (_) {}
    }

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(22, y, 172, 23, 1.2, 1.2, 'FD');
    doc.setFillColor(22, 163, 74);
    doc.rect(22, y, 1.5, 23, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DATOS DEL CLIENTE', 26, y + 4.5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(clientName, 26, y + 9.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(55, 65, 81);
    doc.text(`RNC / Cédula: ${clientNit || '--'}`, 26, y + 14.5);
    doc.text(`Atención / Contacto: ${clientContact || '--'}`, 26, y + 19.5);
    if (clientAddress) {
        const addrClip = doc.splitTextToSize(`Dirección: ${clientAddress}`, 78);
        doc.text(addrClip.slice(0, 2), 112, y + 14.5);
    }

    // 4. Luego: Datos del Consumo (Tabla de Ítems / Servicios)
    const tableX = 22;
    const tableW = 172;
    const colSplit1 = 39;   // Cantidad (17mm)
    const colSplit2 = 143;  // Descripción (104mm)
    const colSplit3 = 171;  // Precio / Subtotal (28mm)
    const tableRight = 194; // ITBIS (23mm)

    let tableY = y + 28;

    const drawQuoteTableHeader = () => {
        doc.setFillColor(22, 163, 74);
        doc.rect(tableX, tableY, tableW, 10, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        doc.rect(tableX, tableY, tableW, 10);
        doc.line(colSplit1, tableY, colSplit1, tableY + 10);
        doc.line(colSplit2, tableY, colSplit2, tableY + 10);
        doc.line(colSplit3, tableY, colSplit3, tableY + 10);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text('Cantidad', (tableX + colSplit1) / 2, tableY + 6, { align: 'center' });
        doc.text('Consumo / Descripción', (colSplit1 + colSplit2) / 2, tableY + 6, { align: 'center' });
        doc.text('Precio / Costo', (colSplit2 + colSplit3) / 2, tableY + 4, { align: 'center' });
        doc.text('RD$', (colSplit2 + colSplit3) / 2, tableY + 7.5, { align: 'center' });
        doc.text('ITBIS', (colSplit3 + tableRight) / 2, tableY + 6, { align: 'center' });
        tableY += 10;
    };

    drawQuoteTableHeader();

    const items = (quote.items && quote.items.length > 0) ? quote.items : [
        {
            qty: 1,
            name: quote.desc || 'Servicio de gestión y reciclaje',
            detailDesc: '',
            desc: quote.desc || 'Servicio de gestión y reciclaje',
            uprice: quote.total || 0,
            subtotal: quote.total || 0,
            isService: true
        }
    ];

    let totalSubtotal = 0;
    let totalItbis = 0;

    items.forEach(item => {
        const qtyVal = item.qty !== undefined && item.qty !== null ? item.qty : 1;
        const unitStr = (!item.isService && item.unit && item.unit !== 'servicio') ? ` ${item.unit}` : '';
        const subtotal = item.subtotal !== undefined
            ? parseFloat(item.subtotal)
            : ((parseFloat(item.uprice) || 0) * (parseFloat(item.qty) || 1));

        let itbisVal = 0;
        if (item.itbis !== undefined && item.itbis !== null) {
            itbisVal = parseFloat(item.itbis);
        } else if (item.taxRate !== undefined) {
            itbisVal = subtotal * parseFloat(item.taxRate);
        } else if (quote.taxRate !== undefined) {
            itbisVal = subtotal * parseFloat(quote.taxRate);
        } else if (quote.includeItbis !== false) {
            itbisVal = subtotal * 0.18;
        }

        totalSubtotal += subtotal;
        totalItbis += itbisVal;

        const titleName = String(item.name || '').trim();
        const detailText = String(item.detailDesc || '').trim();
        let allLines = [];
        if (titleName) {
            allLines.push({ line: titleName, isTitle: true });
            if (detailText) {
                detailText.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => allLines.push({ line: l, isTitle: false }));
            }
        } else {
            const descText = String(item.desc || '--').trim();
            descText.split('\n').map(l => l.trim()).filter(Boolean).forEach((l, idx) => {
                allLines.push({ line: l, isTitle: idx === 0 });
            });
        }

        let descContentHeight = 5;
        const parsedSections = [];

        allLines.forEach(({ line, isTitle }) => {
            const isHeader = line.toLowerCase().startsWith('servicio incluye') || line.toLowerCase().startsWith('incluye:');
            const isBullet = line.startsWith('-') || line.startsWith('*') || line.startsWith('•');

            if (isTitle) {
                const wrapped = doc.splitTextToSize(line, 96);
                parsedSections.push({ type: 'title', lines: wrapped });
                descContentHeight += wrapped.length * 4.2 + 2;
            } else if (isHeader) {
                parsedSections.push({ type: 'header', text: line });
                descContentHeight += 5.5;
            } else if (isBullet) {
                const cleanBullet = line.replace(/^[-*•]\s*/, '');
                const wrapped = doc.splitTextToSize(cleanBullet, 86);
                parsedSections.push({ type: 'bullet', lines: wrapped });
                descContentHeight += wrapped.length * 3.8 + 1.8;
            } else {
                const wrapped = doc.splitTextToSize(line, 96);
                parsedSections.push({ type: 'text', lines: wrapped });
                descContentHeight += wrapped.length * 3.8 + 1.5;
            }
        });

        const naturalRowHeight = Math.max(10, descContentHeight + 4);
        const targetTableEndY = 178;
        const availableHeight = targetTableEndY - tableY;
        const rowHeight = (items.length === 1 && availableHeight > naturalRowHeight) ? availableHeight : naturalRowHeight;

        if (tableY + rowHeight > 225) {
            doc.addPage();
            tableY = 20;
            drawQuoteTableHeader();
        }

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        doc.rect(tableX, tableY, tableW, rowHeight);
        doc.line(colSplit1, tableY, colSplit1, tableY + rowHeight);
        doc.line(colSplit2, tableY, colSplit2, tableY + rowHeight);
        doc.line(colSplit3, tableY, colSplit3, tableY + rowHeight);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.8);
        doc.setTextColor(0, 0, 0);
        doc.text(`${qtyVal}${unitStr}`, (tableX + colSplit1) / 2, tableY + 6.5, { align: 'center' });

        let curDescY = tableY + 6;
        parsedSections.forEach(sec => {
            if (sec.type === 'title') {
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8.8);
                doc.setTextColor(15, 23, 42);
                doc.text(sec.lines, colSplit1 + 4, curDescY);
                curDescY += sec.lines.length * 4.2 + 1.8;
            } else if (sec.type === 'header') {
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8.3);
                doc.setTextColor(0, 0, 0);
                doc.text(sec.text, colSplit1 + 4, curDescY);
                curDescY += 5;
            } else if (sec.type === 'bullet') {
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(8.1);
                doc.setTextColor(55, 65, 81);
                doc.text('-', colSplit1 + 9, curDescY);
                doc.text(sec.lines, colSplit1 + 14, curDescY);
                curDescY += sec.lines.length * 3.8 + 1.5;
            } else {
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(8.2);
                doc.setTextColor(55, 65, 81);
                doc.text(sec.lines, colSplit1 + 4, curDescY);
                curDescY += sec.lines.length * 3.8 + 1.5;
            }
        });

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(formatNum(subtotal), colSplit3 - 2, tableY + 6.5, { align: 'right' });
        doc.text(formatNum(itbisVal), tableRight - 2, tableY + 6.5, { align: 'right' });

        tableY += rowHeight;
    });

    // SubTotal / ITBIS / Total
    if (tableY + 25 > 235) {
        doc.addPage();
        tableY = 20;
    }

    const grandTotal = (quote.total !== undefined && quote.total > 0 && Math.abs(quote.total - (totalSubtotal + totalItbis)) > 1)
        ? quote.total
        : (totalSubtotal + totalItbis);

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(tableX, tableY, tableW, 8.5);
    doc.line(colSplit2, tableY, colSplit2, tableY + 8.5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Total Cotizado', (colSplit1 + colSplit2) / 2, tableY + 5.5, { align: 'center' });
    doc.text(`RD$ ${formatNum(grandTotal)}`, (colSplit2 + tableRight) / 2, tableY + 5.5, { align: 'center' });

    tableY += 8.5;

    // Importante :
    let notesY = tableY + 7;
    if (notesY > 228) {
        doc.addPage();
        notesY = 22;
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38);
    doc.text('Importante :', 22, notesY);
    notesY += 5;

    const bulletList = [];
    if (quote.notes) {
        quote.notes.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
            bulletList.push(line.replace(/^[■•\-\*]\s*/, ''));
        });
    }

    const cond2 = 'La orden de servicio debe ser remitida via correo electronico con 48 horas de antelacion por temas de logistica de transportacion.';
    const cond3 = 'Pagos deberan ser realizados via transferencia bancaria.';
    const cond4 = `Esta cotizacion es valida ${quote.validityDays || 15} días a partir de la fecha de elaboración.`;

    if (!bulletList.some(b => b.toLowerCase().includes('48 horas'))) bulletList.push(cond2);
    if (!bulletList.some(b => b.toLowerCase().includes('transferencia'))) bulletList.push(cond3);
    if (!bulletList.some(b => b.toLowerCase().includes('valida') || b.toLowerCase().includes('validad'))) bulletList.push(cond4);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    bulletList.forEach(bullet => {
        if (notesY > 240) {
            doc.addPage();
            notesY = 22;
        }
        doc.setFillColor(0, 0, 0);
        doc.rect(25, notesY - 2.1, 1.2, 1.2, 'F');
        const splitB = doc.splitTextToSize(bullet, 162);
        doc.text(splitB, 28, notesY);
        notesY += splitB.length * 3.6 + 1.2;
    });

    // 5. Por último: Logo de la empresa al final del documento + pie corporativo
    const afterLogoY = _drawEndDocumentLogo(doc, branding, notesY + 3, 232, 250);
    const footerStartY = Math.max(afterLogoY + 5, 254);

    if (companySlogan) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8.2);
        doc.setTextColor(22, 163, 74);
        doc.text(companySlogan, pageCenter, footerStartY, { align: 'center' });
    }

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(55, 65, 81);
    const oneLineAddr = (branch.branchLocation || issuer.companyAddr || '').replace(/\n/g, ' , ').replace(/\s+/g, ' ');
    if (oneLineAddr) {
        doc.text(`Sucursal: ${branch.branchName} — ${oneLineAddr}`, pageCenter, footerStartY + 5, { align: 'center' });
    }

    const footerContactParts = [];
    if (companyTel) footerContactParts.push(`Teléfono: ${companyTel}`);
    if (companyEmail) footerContactParts.push(`Correo: ${companyEmail}`);
    if (companyRNC) {
        const cleanDigits = companyRNC.replace(/\D/g, '');
        const formattedRNC = cleanDigits.length === 9
            ? cleanDigits.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
            : companyRNC;
        footerContactParts.push(`RNC: ${formattedRNC}`);
    }
    if (footerContactParts.length > 0) {
        doc.text(footerContactParts.join('  |  '), pageCenter, footerStartY + 9.5, { align: 'center' });
    }

    const quoteFilename = `Cotizacion_${quote.id || 'borrador'}.pdf`;
    if (options && options.returnResult === true) {
        const quoteBase64 = (doc.output('datauristring').split(',')[1] || '');
        return {
            filename: quoteFilename,
            base64Data: quoteBase64,
            blob: base64ToBlob(quoteBase64, 'application/pdf')
        };
    }

    deliverGenericPDF(doc, quoteFilename, 'Cotización');
}

// =============================================
// PDF: CONDUCE DE DESPACHO Y ENTREGA
// =============================================
async function generateDispatchPDF(dispatch) {
    if (!dispatch) return;
    const jsPDFConstructor = getJsPDFConstructor();
    if (!jsPDFConstructor) {
        showToast('Error: jsPDF no está cargado', 'error');
        return;
    }

    const branding = await _preparePdfBranding(dispatch);
    const { issuer, branch } = branding;
    const doc = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    // Tarjeta Conduce superior derecha
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(125, 12, 76, 28, 1.5, 1.5, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text("CONDUCE DE DESPACHO", 163, 18, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text(`No. Conduce: ${dispatch.id}`, 130, 24);
    doc.text(`Fecha Salida: ${dispatch.date}`, 130, 28.5);
    doc.text(`Factura Ref: ${dispatch.invoiceRef || 'Sin Factura'}`, 130, 33);
    doc.text(`Sucursal: ${String(branch.branchName || '').slice(0, 24)}`, 130, 37.5);

    // 1. Logo arriba + 2. Debajo Nombre Empresa + Sucursal + ubicación
    let y = _drawStandardIssuerBlock(doc, branding, 12, [51, 65, 85], 15, 44);

    // 3. Debajo: Datos del Cliente / Destinatario y Transporte
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 186, 24, 1.5, 1.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text("DATOS DEL CLIENTE / DESTINATARIO Y TRANSPORTE", 19, y + 5);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Destinatario: ${dispatch.destination}`, 19, y + 10);
    doc.text(`Dirección Entrega: ${dispatch.address}`, 19, y + 14.5);
    doc.text(`Chofer / Conductor: ${dispatch.driver || '—'} (Cédula: ${dispatch.driverId || '—'})`, 19, y + 19);
    doc.text(`Vehículo / Placa: ${dispatch.plate || '—'}`, 120, y + 19);

    y += 29;

    // 4. Luego: Datos del Consumo / Materiales Despachados
    doc.setFillColor(51, 65, 85);
    doc.rect(15, y, 186, 7, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DESCRIPCIÓN DEL MATERIAL DESPACHADO", 18, y + 5);
    doc.text("PESO / CANTIDAD", 120, y + 5);
    doc.text("UNIDAD", 150, y + 5);
    doc.text("BULTOS / SACOS", 172, y + 5);

    y += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const items = dispatch.items || [];
    items.forEach((item, idx) => {
        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, y, 186, 6.5, 'F');
        }
        doc.text(String(item.desc || '--'), 18, y + 4.5);
        doc.text(String(item.qty || 0), 120, y + 4.5);
        doc.text(String(item.unit || 'lb'), 150, y + 4.5);
        doc.text(String(item.packages || '—'), 172, y + 4.5);
        y += 6.5;
    });

    if (dispatch.notes) {
        y += 8;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text("Observaciones de Despacho:", 15, y);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(dispatch.notes, 15, y + 4.5);
        y += 6;
    }

    // Firmas Legales
    y = Math.max(y + 20, 200);
    doc.setDrawColor(148, 163, 184);
    doc.line(25, y, 90, y);
    doc.line(125, y, 190, y);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`DESPACHADO POR (${issuer.companyName.toUpperCase().slice(0, 26)})`, 57.5, y + 5, { align: 'center' });
    doc.text("RECIBIDO CONFORME (CLIENTE)", 157.5, y + 5, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Firma y Sello del Despachador", 57.5, y + 9, { align: 'center' });
    doc.text("Firma, Cédula y Sello de Recibido", 157.5, y + 9, { align: 'center' });

    // 5. Por último: Logo al final
    _drawEndDocumentLogo(doc, branding, y + 12, 236, 265);

    deliverGenericPDF(doc, `Conduce_${dispatch.id}.pdf`, 'Conduce de Despacho');
}

// =============================================
// PDF: NOTA DE CRÉDITO (B04 - DGII)
// =============================================
async function generateCreditNotePDF(creditNote) {
    if (!creditNote) return;
    const jsPDFConstructor = getJsPDFConstructor();
    if (!jsPDFConstructor) {
        showToast('Error: jsPDF no está cargado', 'error');
        return;
    }

    const branding = await _preparePdfBranding(creditNote);
    const { issuer, branch } = branding;
    if (!issuer.companyRNC && typeof showToast === 'function') {
        showToast('⚠️ Configura el RNC y razón social de tu empresa en Parametrizaciones de Empresa antes de emitir notas fiscales.', 'warning');
    }

    const doc = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    // Tarjeta Nota de Crédito superior derecha
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.roundedRect(120, 12, 81, 34, 1.5, 1.5, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(creditNote.ncf ? 10 : 8.5);
    doc.setTextColor(220, 38, 38);
    doc.text(creditNote.ncf ? "NOTA DE CRÉDITO FISCAL (B04)" : "NOTA DE CRÉDITO INTERNA (SIN NCF)", 160.5, 18, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text(`NC #: ${creditNote.id}`, 125, 24);
    doc.text(`NCF: ${creditNote.ncf || 'Interna / Sin NCF'}`, 125, 28.5);
    doc.text(`Fecha: ${creditNote.date}`, 125, 33);
    doc.text(`Sucursal: ${String(branch.branchName || '').slice(0, 24)}`, 125, 37.5);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Modifica: ${creditNote.ncfModified || creditNote.invoiceRef || 'Factura previa'}`, 125, 42);

    // 1. Logo arriba + 2. Debajo Nombre Empresa + Sucursal + ubicación
    let y = _drawStandardIssuerBlock(doc, branding, 12, [220, 38, 38], 15, 50);

    // 3. Debajo: Datos del Cliente
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 186, 20, 1.5, 1.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text("DATOS DEL CLIENTE Y MOTIVO LEGAL", 19, y + 5);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Cliente: ${creditNote.client}`, 19, y + 10);
    doc.text(`RNC / Cédula: ${creditNote.nit || '—'}`, 19, y + 14.5);
    doc.text(`Motivo DGII: ${creditNote.reason || 'Ajuste comercial'}`, 110, y + 10);

    y += 26;

    // 4. Luego: Datos del Consumo / Ajuste
    doc.setFillColor(220, 38, 38);
    doc.rect(15, y, 186, 7, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("CONCEPTO DEL AJUSTE / CRÉDITO", 18, y + 5);
    doc.text("SUBTOTAL", 130, y + 5);
    doc.text("ITBIS (18%)", 155, y + 5);
    doc.text("TOTAL", 180, y + 5);

    y += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(creditNote.concept || 'Devolución o descuento sobre factura', 18, y + 5);
    doc.text(formatMoney(creditNote.subtotal || 0), 130, y + 5);
    doc.text(formatMoney(creditNote.itbis || 0), 155, y + 5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatMoney(creditNote.total || 0)}`, 180, y + 5);

    y += 20;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 201, y);

    y += 10;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Nota legal DGII: Este comprobante modifica el monto facturado originalmente de acuerdo con las disposiciones del Decreto 254-06 de la DGII.", 15, y);

    // 5. Por último: Logo al final
    _drawEndDocumentLogo(doc, branding, y + 10, 236, 265);

    deliverGenericPDF(doc, `Nota_Credito_${creditNote.id}.pdf`, 'Nota de Crédito');
}

// =============================================
// PDF: NOTA DE DÉBITO (B03 - DGII)
// =============================================
async function generateDebitNotePDF(debitNote) {
    if (!debitNote) return;
    const jsPDFConstructor = getJsPDFConstructor();
    if (!jsPDFConstructor) {
        showToast('Error: jsPDF no está cargado', 'error');
        return;
    }

    const branding = await _preparePdfBranding(debitNote);
    const { issuer, branch } = branding;
    if (!issuer.companyRNC && typeof showToast === 'function') {
        showToast('⚠️ Configura el RNC y razón social de tu empresa en Parametrizaciones de Empresa antes de emitir notas fiscales.', 'warning');
    }

    const doc = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    // Tarjeta Nota de Débito superior derecha
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(120, 12, 81, 34, 1.5, 1.5, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(debitNote.ncf ? 10 : 8.5);
    doc.setTextColor(22, 163, 74);
    doc.text(debitNote.ncf ? "NOTA DE DÉBITO FISCAL (B03)" : "NOTA DE DÉBITO INTERNA (SIN NCF)", 160.5, 18, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text(`ND #: ${debitNote.id}`, 125, 24);
    doc.text(`NCF: ${debitNote.ncf || 'Interna / Sin NCF'}`, 125, 28.5);
    doc.text(`Fecha: ${debitNote.date}`, 125, 33);
    doc.text(`Sucursal: ${String(branch.branchName || '').slice(0, 24)}`, 125, 37.5);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Modifica: ${debitNote.ncfModified || debitNote.invoiceRef || 'Factura previa'}`, 125, 42);

    // 1. Logo arriba + 2. Debajo Nombre Empresa + Sucursal + ubicación
    let y = _drawStandardIssuerBlock(doc, branding, 12, [22, 163, 74], 15, 50);

    // 3. Debajo: Datos del Cliente
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 186, 20, 1.5, 1.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text("DATOS DEL CLIENTE Y CONCEPTO", 19, y + 5);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Cliente: ${debitNote.client}`, 19, y + 10);
    doc.text(`RNC / Cédula: ${debitNote.nit || '—'}`, 19, y + 14.5);
    doc.text(`Motivo: ${debitNote.reason || 'Recargo adicional'}`, 110, y + 10);

    y += 26;

    // 4. Luego: Datos del Consumo / Cargo adicional
    doc.setFillColor(22, 163, 74);
    doc.rect(15, y, 186, 7, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("CONCEPTO DEL CARGO ADICIONAL", 18, y + 5);
    doc.text("SUBTOTAL", 130, y + 5);
    doc.text("ITBIS (18%)", 155, y + 5);
    doc.text("TOTAL", 180, y + 5);

    y += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(debitNote.concept || 'Intereses o gastos adicionales', 18, y + 5);
    doc.text(formatMoney(debitNote.subtotal || 0), 130, y + 5);
    doc.text(formatMoney(debitNote.itbis || 0), 155, y + 5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(`+${formatMoney(debitNote.total || 0)}`, 180, y + 5);

    y += 20;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 201, y);

    y += 10;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Nota legal DGII: Este comprobante incrementa el valor de la factura de referencia según lo establecido por las normas de la DGII.", 15, y);

    // 5. Por último: Logo al final
    _drawEndDocumentLogo(doc, branding, y + 10, 236, 265);

    deliverGenericPDF(doc, `Nota_Debito_${debitNote.id}.pdf`, 'Nota de Débito');
}

// Exportar globalmente
window.generateQuotePDF = generateQuotePDF;
window.generateDispatchPDF = generateDispatchPDF;
window.generateCreditNotePDF = generateCreditNotePDF;
window.generateDebitNotePDF = generateDebitNotePDF;

