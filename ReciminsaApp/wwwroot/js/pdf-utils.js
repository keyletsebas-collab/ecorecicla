/* =========================================================================
   PDF-UTILS.JS – Generación de PDF Global Mejorado (Versión Premium)
   Soporta Formato Corporativo (Carta) y Formato Ticket (POS 80mm)
   ========================================================================= */

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
    const cur = typeof getCurrency === 'function' ? getCurrency() : { code: 'DOP' };
    const currencyName = cur.code === 'USD' ? 'DÓLARES' : 'PESOS';
    const centavosName = cur.code === 'USD' ? 'USD' : 'DOP';

    const unidades = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = {
        11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE'
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
            } else if (rest >= 11 && rest <= 19) {
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

    if (num === 0) return `CERO ${currencyName}`;
    
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);
    
    let letras = '';
    if (entero < 1000) {
        letras = convCentena(entero);
    } else if (entero < 1000000) {
        const miles = Math.floor(entero / 1000);
        const resto = entero % 1000;
        letras = (miles === 1 ? 'MIL' : convCentena(miles) + ' MIL') + ' ' + convCentena(resto);
    } else {
        letras = 'MONTO MUY GRANDE';
    }
    
    const centavosStr = String(centavos).padStart(2, '0');
    return `SON: ${letras.trim()} ${currencyName} CON ${centavosStr}/100 ${centavosName}`;
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
function calculateTicketHeight(invoice, jsPDFConstructor, logoHeight = 0) {
    let height = 5; // Margen superior
    let settings = {};
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
    } catch(e){}

    const companyEmail = settings.companyEmail || settings.userEmail || '';
    const companyAddr = settings.companyAddress || '';
    
    if (logoHeight > 0) {
        height += logoHeight + 2;
    } else {
        height += 8;
    }
    
    // Altura para información del emisor
    height += 7; // RNC + Tel
    if (companyEmail) height += 3.5;
    if (companyAddr) {
        const docTemp = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
        docTemp.setFont('Helvetica', 'normal');
        docTemp.setFontSize(7.5);
        const splitAddr = docTemp.splitTextToSize(companyAddr, 74);
        height += splitAddr.length * 3.5;
    }
    height += 4; // Separador
    
    // Título y metadatos
    height += 16; 
    if (invoice.ncf) {
        height += 3.5;
    }
    
    // Cliente
    height += 4;
    height += 4; // Separador
    
    // Encabezado de tabla
    height += 6.5;
    
    // Items (con wrapping de descripción)
    const docTemp = new jsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
    docTemp.setFont('Helvetica', 'normal');
    docTemp.setFontSize(7.5);
    
    const items = invoice.items || [];
    items.forEach(item => {
        const desc = item.desc || item.name || '--';
        const splitDesc = docTemp.splitTextToSize(desc, 42); // 42mm para la descripción
        const lines = splitDesc.length;
        height += Math.max(lines * 3.5, 4.5); 
    });
    
    height += 4; // Separador de totales
    
    // Totales
    let totalLines = 1; // Subtotal
    if (invoice.taxRate > 0 || invoice.ncfType === 'B14') totalLines++; // ITBIS
    if (invoice.iscAmount > 0) totalLines++;
    if (invoice.retIsrAmount > 0) totalLines++;
    if (invoice.retItbisAmount > 0) totalLines++;
    totalLines++; // Fila de Total a Pagar
    
    height += totalLines * 4;
    
    // Notas
    if (invoice.notes) {
        const splitNotes = docTemp.splitTextToSize(`Notas: ${invoice.notes}`, 74);
        height += splitNotes.length * 3.5 + 4;
    }
    
    // Pie de página
    height += 4; // Separador final
    if (invoice.ncfType === 'B02') height += 4; // "Gracias por reciclar"
    height += 6; // Crédito app + margen inferior
    
    return height;
}

function generateInvoicePDF(invoice, format = null) {
    if (!invoice) return;

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

    proceedWithPDF(invoice, determinedFormat);
}

async function proceedWithPDF(invoice, format) {
    // Normalizar factura básica como consumidor final B02 de forma segura sin mutar el original
    if (invoice.type === 'basica') {
        invoice = {
            ...invoice,
            ncfType: 'B02',
            ncf: invoice.ncf || ('B02' + (String(invoice.id || '').replace(/\D/g, '') || '0').padStart(8, '0')),
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

    // Configuración de marca blanca
    let settings = {};
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
    } catch(e) {
        console.error("Error reading settings in PDF:", e);
    }

    const companyName  = settings.companyName  || 'RECIMINSA, SRL';
    const companyAddr  = settings.companyAddress || 'Calle Principal #01, Santo Domingo, Rep. Dom.';
    const companyLogo  = settings.companyLogo || window.DEFAULT_APP_LOGO || '';

    let companyRNC = settings.companyRNC || '133250233';
    let companyTel = settings.companyPhone || settings.userPhone || '+1 (849) 585-0386';
    let companyEmail = settings.companyEmail || settings.userEmail || 'contacto@reciminsa.com';

    if (typeof userKey === 'function') {
        try {
            const sharedSettings = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
            if (sharedSettings.companyRNC) companyRNC = sharedSettings.companyRNC;
            if (sharedSettings.companyPhone || sharedSettings.userPhone) companyTel = sharedSettings.companyPhone || sharedSettings.userPhone;
            if (sharedSettings.companyEmail || sharedSettings.userEmail) companyEmail = sharedSettings.companyEmail || sharedSettings.userEmail;
            if (sharedSettings.companyAddress) companyAddr = sharedSettings.companyAddress;
        } catch (e) {
            console.error('Error loading shared settings in PDF:', e);
        }
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

    // Calculate logo dimensions if logo exists
    let computedLogoWidth = 0;
    let computedLogoHeight = 0;
    let logoFormat = 'PNG';
    if (companyLogo && (companyLogo.startsWith('data:image/') || companyLogo.includes('base64'))) {
        if (companyLogo.includes('image/jpeg') || companyLogo.includes('image/jpg')) {
            logoFormat = 'JPEG';
        }
        try {
            const dims = await getImageDimensions(companyLogo);
            if (dims.width > 0 && dims.height > 0) {
                const aspectRatio = dims.width / dims.height;
                if (isTicket) {
                    computedLogoWidth = 22;
                    computedLogoHeight = computedLogoWidth / aspectRatio;
                    if (computedLogoHeight > 22) {
                        computedLogoHeight = 22;
                        computedLogoWidth = computedLogoHeight * aspectRatio;
                    }
                } else {
                    computedLogoWidth = 35;
                    computedLogoHeight = computedLogoWidth / aspectRatio;
                    if (computedLogoHeight > 18) {
                        computedLogoHeight = 18;
                        computedLogoWidth = computedLogoHeight * aspectRatio;
                    }
                }
            }
        } catch (e) {
            console.error("Error calculating logo dimensions:", e);
        }
    }

    let doc;
    if (isTicket) {
        // === FORMATO TICKET (POS 80mm) ===
        const pageHeight = calculateTicketHeight(invoice, jsPDFConstructor, computedLogoHeight);
        doc = new jsPDFConstructor({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, pageHeight]
        });

        let y = 5;

        // Logo centrado o nombre emisor
        if (computedLogoHeight > 0) {
            try {
                const logoX = (80 - computedLogoWidth) / 2;
                doc.addImage(companyLogo, logoFormat, logoX, y, computedLogoWidth, computedLogoHeight);
                y += computedLogoHeight + 5;
            } catch (e) {
                console.error("Error drawing logo in ticket:", e);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(companyName, 40, y + 4, { align: 'center' });
                y += 8;
            }
        } else {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(companyName, 40, y + 4, { align: 'center' });
            y += 8;
        }

        // Datos del emisor centrados
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`RNC: ${companyRNC}`, 40, y, { align: 'center' });
        y += 3.5;
        doc.text(`Tel: ${companyTel}`, 40, y, { align: 'center' });
        y += 3.5;

        if (companyEmail) {
            doc.text(`Email: ${companyEmail}`, 40, y, { align: 'center' });
            y += 3.5;
        }
        
        if (companyAddr) {
            const addrLines = doc.splitTextToSize(companyAddr, 74);
            addrLines.forEach(l => {
                doc.text(l, 40, y, { align: 'center' });
                y += 3.5;
            });
        }

        // Separador punteado
        y += 1;
        doc.setLineWidth(0.15);
        doc.setDrawColor(150, 150, 150);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(2, y, 78, y);
        doc.setLineDashPattern([], 0); // reset
        y += 4;

        // Título del documento destacado
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        
        let ticketTitle = "RECIBO INTERNO";
        if (invoice.ncfType === 'B02') {
            ticketTitle = "FACTURA DE CONSUMIDOR FINAL";
        } else if (invoice.ncfType === 'B01') {
            ticketTitle = "FACTURA DE CRÉDITO FISCAL";
        } else if (invoice.ncfType === 'B14') {
            ticketTitle = "REGIMEN ESPECIAL";
        } else if (invoice.ncfType === 'B15') {
            ticketTitle = "GUBERNAMENTAL";
        } else if (invoice.notes && invoice.notes.toUpperCase().includes("COTIZACION")) {
            ticketTitle = "COTIZACIÓN";
        } else if (invoice.typeName) {
            if (invoice.typeName.toLowerCase() === 'empresarial') {
                ticketTitle = "FACTURA DE CRÉDITO FISCAL";
            } else {
                ticketTitle = invoice.typeName.toUpperCase();
            }
        }
        doc.text(ticketTitle, 40, y, { align: 'center' });
        y += 4.5;

        // Metadatos
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Factura: ${invoiceNum.replace('RICI ', '')}`, 2, y);
        doc.text(`Fecha: ${emisionFmt}`, 78, y, { align: 'right' });
        y += 3.5;

        if (invoice.ncf) {
            doc.setFont('Helvetica', 'bold');
            doc.text(`NCF: ${invoice.ncf}`, 2, y);
            doc.setFont('Helvetica', 'normal');
            doc.text("Vence: 31/12/2027", 78, y, { align: 'right' });
            y += 3.5;
        }

        // Cliente
        const displayClient = (clientName && clientName !== '--') ? clientName : "Cliente al Contado";
        doc.text(`Cliente: ${displayClient}`, 2, y);
        y += 4;

        // Separador punteado
        doc.setLineDashPattern([1, 1], 0);
        doc.line(2, y, 78, y);
        doc.setLineDashPattern([], 0);
        y += 3.5;

        // Cabecera tabla
        doc.setFont('Helvetica', 'bold');
        doc.text("Cant", 2, y);
        doc.text("Descripción", 12, y);
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

        // Pie de página de ticket
        y += 1;
        doc.setLineWidth(0.1);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(2, y, 78, y);
        doc.setLineDashPattern([], 0);
        y += 4;

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
        doc = new jsPDFConstructor({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        });

        const accentColor = isBasica ? [59, 130, 246] : [22, 163, 74]; // Azul para Básica, Verde Reciminsa para Ventas NCF
        let y = 15;

        // 1. Cabecera - Logo & Datos Emisor
        let logoHeightToUse = 0;
        if (companyLogo && (companyLogo.startsWith('data:image/') || companyLogo.includes('base64'))) {
            try {
                doc.addImage(companyLogo, logoFormat, 15, y, computedLogoWidth, computedLogoHeight);
                logoHeightToUse = computedLogoHeight;
            } catch (e) {
                console.error("Error drawing logo in letter PDF:", e);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.text(companyName, 15, y + 6);
                logoHeightToUse = 8;
            }
        } else {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.text(companyName, 15, y + 6);
            logoHeightToUse = 8;
        }

        // Datos del Emisor (Columna Izquierda)
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        
        let emisorTextY = y + logoHeightToUse + 4;
        doc.text(`RNC: ${companyRNC}`, 15, emisorTextY);
        emisorTextY += 3.8;
        doc.text(`Tel: ${companyTel}`, 15, emisorTextY);
        emisorTextY += 3.8;
        
        if (companyEmail) {
            doc.text(`Email: ${companyEmail}`, 15, emisorTextY);
            emisorTextY += 3.8;
        }

        if (companyAddr) {
            const addrLines = doc.splitTextToSize(companyAddr, 95);
            addrLines.forEach(l => {
                doc.text(l, 15, emisorTextY);
                emisorTextY += 3.8;
            });
        }

        // Bloque del Comprobante (Ficha Derecha Destacada)
        let blockTitle = "FACTURA DE CRÉDITO FISCAL";
        if (isBasica) {
            blockTitle = "FACTURA BÁSICA";
        } else if (invoice.ncfType === 'B14') {
            blockTitle = "FACTURA DE RÉGIMEN ESPECIAL";
        } else if (invoice.ncfType === 'B15') {
            blockTitle = "FACTURA GUBERNAMENTAL";
        } else if (invoice.ncfType === 'B02') {
            blockTitle = "FACTURA DE CONSUMIDOR FINAL";
        } else if (invoice.typeName) {
            blockTitle = invoice.typeName.toUpperCase();
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

        // Divider interno en tarjeta
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

            doc.setFont('Helvetica', 'bold');
            doc.text(`Vence:`, 128, dataY);
            doc.setFont('Helvetica', 'normal');
            doc.text("31/12/2027", 155, dataY);
            dataY += 4.2;
        }

        doc.setFont('Helvetica', 'bold');
        doc.text(`Fecha:`, 128, dataY);
        doc.setFont('Helvetica', 'normal');
        doc.text(emisionFmt, 155, dataY);
        dataY += 4.2;
        
        doc.text(`Ciudad:`, 128, dataY);
        doc.text("Santo Domingo, R.D.", 155, dataY);

        // 2. Sección del Cliente (Aislado y Limpio)
        y = 56;
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.25);
        doc.roundedRect(15, y, 185.9, 25, 1, 1, 'FD');

        // Borde verde/azul acentuado izquierdo
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(15, y, 1.5, 25, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        
        let clientLabel = "FACTURAR A";
        if (isBasica) {
            clientLabel = "PROVEEDOR / CLIENTE";
        } else if (invoice.ncfType === 'B15') {
            clientLabel = "INSTITUCIÓN DEL ESTADO";
        } else if (invoice.ncfType === 'B02') {
            clientLabel = "DATOS DEL CLIENTE";
        }
        doc.text(clientLabel, 19, y + 4.5);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(clientName, 19, y + 9.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        // Grid de datos del cliente
        doc.text(`RNC/Cédula: ${clientRNC}`, 19, y + 14.5);
        doc.text(`Contacto: ${clientContact}`, 19, y + 19.5);

        doc.text(`Dirección: ${clientAddr}`, 115, y + 14.5);

        // 3. Tabla de Artículos
        y = 88;
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
        if (invoice.ncfType !== 'B02') {
            let sigY = Math.max(totalRowY + 15, y + 20);
            if (sigY > 250) {
                doc.addPage();
                sigY = 40;
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
    if (typeof showToast === 'function') {
        showToast('Generando y procesando PDF...', 'info');
    }

    const pdfBase64 = doc.output('datauristring');
    const base64Data = pdfBase64.split(',')[1];

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

    // --- PUENTE NATIVO WINDOWS (MAUI WebView2) ---
    if (window.chrome && window.chrome.webview) {
        try {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'download',
                filename: `Factura_${invoice.id}.pdf`,
                data: base64Data
            }));
            if (typeof showToast === 'function') {
                showToast('📄 Factura abierta en tu programa predeterminado', 'success');
            }
            return;
        } catch (bridgeErr) {
            console.warn('WebView2 bridge error, continuando con descarga...', bridgeErr);
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
