/* =============================================
   EXCEL-UTILS.JS – Exportación a XLSX (SheetJS / xlsx-js-style)
   Modelo: Registro de Residuos, Finanzas y Materiales
   ============================================= */

/**
 * Aplica estilos premium, alineación, formato de moneda y auto-ajuste de columnas a una hoja de cálculo
 */
function formatAndStyleWorksheet(ws) {
    if (!ws || !ws['!ref']) return ws;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const cur = (typeof getCurrency === 'function') ? getCurrency() : { symbol: 'RD$', code: 'DOP' };
    const currencyFormat = `#,##0.00`;
    
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const headerCell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        headers.push(headerCell ? String(headerCell.v).toLowerCase().trim() : '');
    }

    const colWidths = Array(headers.length).fill(10);
    const headerStyle = {
        font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1B4A3E' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
            top: { style: 'medium', color: { rgb: '11382F' } },
            bottom: { style: 'medium', color: { rgb: '11382F' } },
            left: { style: 'thin', color: { rgb: '4D7C6F' } },
            right: { style: 'thin', color: { rgb: '4D7C6F' } }
        }
    };
    const borderStyle = {
        top: { style: 'thin', color: { rgb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
        left: { style: 'thin', color: { rgb: 'E5E7EB' } },
        right: { style: 'thin', color: { rgb: 'E5E7EB' } }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        const isHeader = (R === range.s.r);
        const zebraFill = { fgColor: { rgb: (R % 2 === 0) ? 'FFFFFF' : 'F3F7F5' } };

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            let cell = ws[cellRef];
            
            if (!cell) {
                if (!isHeader) ws[cellRef] = { t: 's', v: '', s: { fill: zebraFill, border: borderStyle } };
                continue;
            }

            if (cell.t === 's' && cell.v !== '' && !isNaN(cell.v) && isFinite(cell.v)) {
                cell.t = 'n';
                cell.v = Number(cell.v);
            }

            if (isHeader) {
                cell.s = headerStyle;
            } else {
                const headerText = headers[C] || '';
                let align = cell.t === 'n' ? 'right' : 'left';
                
                if (['id', 'fecha', 'código', 'codigo', 'tipo', 'unidad', 'hora'].some(w => headerText.includes(w))) {
                    align = 'center';
                }

                let isCurrency = ['monto', 'precio', 'subtotal', 'total', 'ganancia', 'costo', 'balance', 'inversión', 'inversion', 'ingreso', 'egreso'].some(w => headerText.includes(w));
                
                if (C === 1) { 
                    const labelCell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
                    if (labelCell && typeof labelCell.v === 'string') {
                        const labelLower = labelCell.v.toLowerCase();
                        if (['total', 'ganancia', 'costo', 'monto', 'precio', 'inversión', 'inversion', 'balance'].some(w => labelLower.includes(w))) {
                            isCurrency = true;
                        }
                    }
                }

                if (isCurrency && (cell.t === 'n' || cell.f)) cell.z = currencyFormat;

                // Check if this is a totals row
                const labelCell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
                const isTotalRow = labelCell && typeof labelCell.v === 'string' && labelCell.v.toLowerCase().includes('total');

                let fontColor = '374151';
                if (headerText.includes('egreso') && (cell.t === 'n' ? cell.v > 0 : true)) {
                    fontColor = 'FF0000';
                }

                if (isTotalRow) {
                    cell.s = {
                        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: fontColor } },
                        fill: { fgColor: { rgb: 'E8F2ED' } },
                        alignment: { horizontal: C === 0 ? 'left' : align, vertical: 'center' },
                        border: {
                            top: { style: 'thin', color: { rgb: '1B4A3E' } },
                            bottom: { style: 'double', color: { rgb: '1B4A3E' } },
                            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                        }
                    };
                } else {
                    cell.s = {
                        font: { name: 'Segoe UI', sz: 10, color: { rgb: fontColor } },
                        fill: zebraFill,
                        alignment: { horizontal: align, vertical: 'center' },
                        border: borderStyle
                    };
                }
            }

            let valStr = '';
            if (cell.f) valStr = '   999,999.00   '; 
            else if (cell.v != null) {
                valStr = String(cell.v);
                if (cell.t === 'n' && cell.z === currencyFormat) valStr = valStr + '.00';
            }
            colWidths[C] = Math.max(colWidths[C], valStr.length + 3);
        }
    }

    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 40) }));
    const rowHeights = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
        rowHeights.push({ hpt: (R === range.s.r) ? 26 : 20 });
    }
    ws['!rows'] = rowHeights;
    ws['!freeze'] = { xSplit: 0, ySplit: range.s.r + 1 };
    return ws;
}

// ---------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------

function getUsuarioNombre() {
    const currentUser = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
    return currentUser ? (currentUser.displayName || currentUser.email || 'Usuario') : 'Usuario';
}

function fmtFecha(dateStr) {
    if (!dateStr) return '';
    const dStr = _extractValidDate({ date: dateStr });
    const parts = dStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function _extractValidDate(item) {
    if (!item) return new Date().toISOString().split('T')[0];
    let d = item.date || item.fecha || item.createdAt || item.created_at;
    if (!d) return new Date().toISOString().split('T')[0];
    if (typeof d === 'string') {
        let trimmed = d.trim();
        if (trimmed.includes('T')) trimmed = trimmed.split('T')[0];
        if (trimmed.includes(' ')) trimmed = trimmed.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(trimmed)) {
            const parts = trimmed.split(/[\/-]/);
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
}

function buildInvoiceSheet(invoices, isBitacoraList = false) {
    const headers = isBitacoraList
      ? ['ID Bitácora', 'Fecha', 'Cliente/Procedencia', 'Material', 'Cantidad', 'Unidad', 'Peso (kg)', 'Costo Compra', 'Precio Venta', 'Total Compra', 'Total Venta', 'Balance', 'Notas']
      : ['ID', 'Fecha', 'Cliente', 'Tipo', 'Material', 'Cantidad', 'Unidad', 'Precio Compra', 'Precio Venta', 'Total Compra', 'Total Venta', 'Ganancia', 'Notas'];
    
    const rows = [];
    let rowNum = 2;

    invoices.forEach(inv => {
        const invDate = _extractValidDate(inv);
        (inv.items || []).forEach(item => {
            const pBuy = item.priceBuy || item.uprice || 0;
            const pSell = item.priceSell || 0;
            const qtyCol = isBitacoraList ? 'E' : 'F';
            const costCol = isBitacoraList ? 'H' : 'H';
            const sellCol = isBitacoraList ? 'I' : 'I';
            const tCostCol = isBitacoraList ? 'J' : 'J';
            const tSellCol = isBitacoraList ? 'K' : 'K';
            
            const r = isBitacoraList 
              ? [inv.id, invDate, inv.client || '—', item.name || '', item.qty || 0, item.unit || 'lb', item.peso || 0, pBuy, pSell, {f: `${qtyCol}${rowNum}*${costCol}${rowNum}`}, {f: `${qtyCol}${rowNum}*${sellCol}${rowNum}`}, {f: `${tSellCol}${rowNum}-${tCostCol}${rowNum}`}, inv.notes || '']
              : [inv.id, invDate, inv.client || inv.company || '—', inv.type || 'basic', item.name || item.desc || '', item.qty || 0, item.unit || 'kg', pBuy, pSell, {f: `${qtyCol}${rowNum}*${costCol}${rowNum}`}, {f: `${qtyCol}${rowNum}*${sellCol}${rowNum}`}, {f: `${tSellCol}${rowNum}-${tCostCol}${rowNum}`}, inv.notes || ''];
            
            rows.push(r);
            rowNum++;
        });
    });
    return { name: isBitacoraList ? 'Registros_Detallados' : 'Facturas', data: [headers, ...rows] };
}

function buildFinanceSheet(dataList, sheetName) {
    const headers = ['ID', 'Fecha', 'Concepto', 'Monto', 'Categoría', 'Notas', 'ID Referencia'];
    const rows = dataList.map(item => [item.id, _extractValidDate(item), item.concept, item.amount, item.category || 'General', item.notes || '', item.ref || '']);
    return { name: sheetName, data: [headers, ...rows] };
}

function buildCombinedFinanceSheet(incomes, expenses, invoices = []) {
    const headers = ['Fecha', 'Origen', 'Descripción', 'Ingreso Money IN', 'Egreso Money OUT', 'Balance general', 'Notas'];
    
    const invoiceIds = new Set(invoices.map(inv => inv.id).filter(Boolean));
    const combined = [];

    // Add direct incomes that do not reference an invoice ID
    incomes.forEach(item => {
        if (!item.ref || !invoiceIds.has(item.ref)) {
            combined.push({ ...item, type: 'income' });
        }
    });

    // Add direct expenses that do not reference an invoice ID
    expenses.forEach(item => {
        if (!item.ref || !invoiceIds.has(item.ref)) {
            combined.push({ ...item, type: 'expense' });
        }
    });

    // Add invoices (sales & purchases)
    invoices.forEach(inv => {
        if (inv.type === 'empresa' || inv.type === 'local' || !inv.type) {
            combined.push({
                date: inv.date,
                category: 'Ventas (Factura)',
                concept: `Factura ${inv.typeName || 'Venta'}: ${inv.id} – ${inv.company || inv.client || ''}`,
                amount: inv.total !== undefined ? inv.total : (inv.totalVenta || 0),
                notes: inv.notes || '',
                type: 'income'
            });
        } else if (inv.type === 'basica') {
            if (inv.totalCompra && inv.totalCompra > 0) {
                combined.push({
                    date: inv.date,
                    category: 'Materiales (Compra)',
                    concept: `Bitácora Compra: ${inv.id} – ${inv.client || ''}`,
                    amount: inv.totalCompra,
                    notes: inv.notes || '',
                    type: 'expense'
                });
            }
            if (inv.totalVenta && inv.totalVenta > 0) {
                combined.push({
                    date: inv.date,
                    category: 'Materiales (Venta)',
                    concept: `Bitácora Venta: ${inv.id} – ${inv.client || ''}`,
                    amount: inv.totalVenta,
                    notes: inv.notes || '',
                    type: 'income'
                });
            }
        }
    });
    
    // Ordenar cronológicamente por fecha
    combined.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const rows = [];
    let r = 2; // La fila de datos empieza en la 2 (cabecera en la 1)
    
    combined.forEach(item => {
        const dateStr = fmtFecha(item.date);
        const origin = item.category || 'General';
        const desc = item.concept || '';
        const notes = item.notes || '';
        
        let ing = 0;
        let egr = 0;
        if (item.type === 'income') {
            ing = item.amount || 0;
        } else {
            egr = item.amount || 0;
        }
        
        // Fórmula para el balance general:
        const balanceFormula = r === 2 
            ? { f: `D${r}-E${r}` } 
            : { f: `F${r-1}+D${r}-E${r}` };
            
        rows.push([dateStr, origin, desc, ing, egr, balanceFormula, notes]);
        r++;
    });
    
    if (rows.length > 0) {
        // Fila vacía de separación
        rows.push(['', '', '', '', '', '', '']);
        r++;
        
        // Fórmulas para los totales
        const totalInFormula = { f: `SUM(D2:D${r-2})` };
        const totalOutFormula = { f: `SUM(E2:E${r-2})` };
        const netBalanceFormula = { f: `D${r}-E${r}` };
        
        rows.push(['TOTAL GENERAL', '', '', totalInFormula, totalOutFormula, netBalanceFormula, '']);
    }
    
    return { name: 'Finanzas', data: [headers, ...rows] };
}

function buildMaterialsSheet() {
    const mats = (typeof getMaterialCodes === 'function') ? getMaterialCodes() : [];
    const headers = ['Código', 'Nombre', 'Unidad'];
    const rows = mats.map(m => [m.id || m.code || '', m.name || '', m.unit || 'kg']);
    return { name: 'Catálogo_Materiales', data: [headers, ...rows] };
}

// ---------------------------------------------------------
// EXPORT FUNCTIONS
// ---------------------------------------------------------

function downloadExcel(wb, filename) {
    if (window.AndroidNative && typeof window.AndroidNative.DownloadFile === 'function') {
        try {
            const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
            window.AndroidNative.DownloadFile(filename, base64Data);
            if (typeof showToast === 'function') {
                showToast('✅ Excel guardado en Descargas', 'success');
            }
            return;
        } catch (androidErr) {
            console.warn('Android native bridge excel error:', androidErr);
        }
    }

    if (window.chrome && window.chrome.webview) {
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        window.chrome.webview.postMessage(JSON.stringify({
            action: 'download',
            filename: filename,
            data: base64Data
        }));
        showToast('✅ Excel abierto en tu programa predeterminado', 'success');
    } else {
        XLSX.writeFile(wb, filename);
        showToast('✅ Excel descargado correctamente', 'success');
    }
}

function exportarExcelResiduos(invoice) {
    if (!invoice || typeof XLSX === 'undefined') return showToast('❌ Librería Excel no disponible', 'error');
    try {
        showToast('📊 Generando Excel...', 'info');
        const wb = XLSX.utils.book_new();

        // Hoja 1: Detalles
        const horaActual = (() => {
            const d = new Date(invoice.createdAt || Date.now());
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        })();
        const items = invoice.items || [];
        const dataRows = items.map((item, idx) => {
            const rN = idx + 2;
            return [fmtFecha(invoice.date), horaActual, item.matId || item.code || '', item.name || item.desc || '', invoice.client || invoice.company || '—', item.qty || 0, item.unit || 'kg', item.priceBuy || item.uprice || 0, item.priceSell || 0, {f:`F${rN}*H${rN}`}, {f:`F${rN}*I${rN}`}, {f:`K${rN}-J${rN}`}, getUsuarioNombre(), invoice.notes || ''];
        });
        const headers1 = ['Fecha', 'Hora', 'Código', 'Nombre del residuo', 'Proveedor / Procedencia', 'Cantidad', 'Unidad de medida', 'Precio de compra', 'Precio de venta', 'Total compra', 'Total venta', 'Ganancia', 'Usuario', 'Observaciones'];
        const ws1 = formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet([headers1, ...dataRows]));
        XLSX.utils.book_append_sheet(wb, ws1, 'Registros_Diarios');

        // Hoja 2: Resumen
        const totalKg = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const totalCompra = items.reduce((s, i) => s + ((i.qty || 0) * (i.priceBuy || i.uprice || 0)), 0);
        const totalVenta = items.reduce((s, i) => s + ((i.qty || 0) * (i.priceSell || 0)), 0);
        const cur = (typeof getCurrency === 'function') ? getCurrency() : { symbol: 'RD$', code: 'DOP' };
        const principal = items.reduce((max, i) => (parseFloat(i.qty) || 0) > (parseFloat(max.qty) || 0) ? i : max, items[0] || {});
        
        const ws2Data = [
            ['Campo', 'Valor'], ['Fecha', fmtFecha(invoice.date)], ['ID Factura', invoice.id], ['Proveedor', invoice.client || invoice.company || '—'],
            ['Total cantidad recibida', totalKg], [`Total comprado ${cur.code}`, totalCompra], [`Total vendido ${cur.code}`, totalVenta],
            [`Ganancia total ${cur.code}`, totalVenta - totalCompra], ['Residuo principal', principal.name || '—'], ['Usuario', getUsuarioNombre()]
        ];
        const ws2 = formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(ws2Data));
        XLSX.utils.book_append_sheet(wb, ws2, 'Resumen_Diario');

        // Hoja 3: Catalogo
        const ws3 = formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(buildMaterialsSheet().data));
        XLSX.utils.book_append_sheet(wb, ws3, 'Catalogo_Codigos');

        downloadExcel(wb, `Residuos_${invoice.id}_${(invoice.date || '').replace(/-/g, '')}.xlsx`);
    } catch (err) {
        console.error(err);
        showToast('❌ Error al generar Excel', 'error');
    }
}

function exportAllDataToExcel() {
    exportSelectedDataToExcel({ invoices: true, income: true, expenses: true, materials: true });
}

function exportSelectedDataToExcel(selection = {}) {
    if (typeof XLSX === 'undefined') return showToast('❌ Librería Excel no disponible', 'error');
    try {
        showToast('📊 Generando Excel...', 'info');
        const wb = XLSX.utils.book_new();
        let sheetsAdded = 0;

        // --- Filter helpers ---
        const dateFrom = selection.dateFrom || '';
        const dateTo = selection.dateTo || '';
        const clientId = selection.clientId || '';

        function matchesDateFilter(item) {
            if (!dateFrom && !dateTo) return true;
            const d = (item.date || item.fecha || '').split('T')[0];
            if (!d) return true; // include items without date
            if (dateFrom && d < dateFrom) return false;
            if (dateTo && d > dateTo) return false;
            return true;
        }
        function matchesClientFilter(item) {
            if (!clientId) return true;
            return (item.clientId === clientId || item.client_id === clientId);
        }
        function applyFilters(arr) {
            return arr.filter(item => matchesDateFilter(item) && matchesClientFilter(item));
        }

        if (selection.invoices) {
            let invs = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
            invs = applyFilters(invs);
            if (invs.length) {
                const s = buildInvoiceSheet(invs);
                XLSX.utils.book_append_sheet(wb, formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(s.data)), s.name);
                sheetsAdded++;
            }
        }
        if (selection.income || selection.expenses || selection.invoices) {
            let ings = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
            let egs = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
            let invs = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
            ings = applyFilters(ings);
            egs = applyFilters(egs);
            invs = applyFilters(invs);
            if (ings.length || egs.length || invs.length) {
                const s = buildCombinedFinanceSheet(ings, egs, invs);
                XLSX.utils.book_append_sheet(wb, formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(s.data)), s.name);
                sheetsAdded++;
            }
        }
        if (selection.materials) {
            const s = buildMaterialsSheet();
            if (s.data.length > 1) {
                XLSX.utils.book_append_sheet(wb, formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(s.data)), s.name);
                sheetsAdded++;
            }
        }

        if (sheetsAdded === 0) return showToast('⚠️ No hay datos para exportar en el rango seleccionado', 'warning');
        const suffix = dateFrom && dateTo ? `_${dateFrom}_a_${dateTo}` : '';
        downloadExcel(wb, `Reciminsa_Export${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        console.error(err);
        showToast('❌ Error al exportar datos', 'error');
    }
}

function exportBitacorasListToExcel(bitacoras) {
    if (!bitacoras || bitacoras.length === 0) return showToast('⚠️ No hay bitácoras para exportar', 'warning');
    if (typeof XLSX === 'undefined') return showToast('❌ Librería Excel no disponible', 'error');

    try {
        showToast('📊 Generando Excel de Bitácoras...', 'info');
        const wb = XLSX.utils.book_new();

        const s1 = buildInvoiceSheet(bitacoras, true);
        XLSX.utils.book_append_sheet(wb, formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(s1.data)), s1.name);

        const matSummary = {};
        bitacoras.forEach(b => {
            (b.items || []).forEach(item => {
                const mid = item.matId || item.name;
                if (!matSummary[mid]) matSummary[mid] = { 'Material': item.name, 'Cant. Total': 0, 'Peso Total (kg)': 0, 'Inversión Total': 0, 'Venta Est.': 0 };
                matSummary[mid]['Cant. Total'] += (item.qty || 0);
                matSummary[mid]['Peso Total (kg)'] += (item.peso || 0);
                matSummary[mid]['Inversión Total'] += (item.totalCompra || 0);
                matSummary[mid]['Venta Est.'] += (item.totalVenta || 0);
            });
        });

        const sumRows = [];
        let sumRowNum = 2;
        Object.values(matSummary).forEach(s => {
            sumRows.push([s.Material, s['Cant. Total'], s['Peso Total (kg)'], s['Inversión Total'], s['Venta Est.'], { f: `E${sumRowNum}-D${sumRowNum}` }]);
            sumRowNum++;
        });

        const wsSum = formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet([['Material', 'Cant. Total', 'Peso Total (kg)', 'Inversión Total', 'Venta Est.', 'Balance'], ...sumRows]));
        XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen_Materiales');

        downloadExcel(wb, `Bitacora_Recogida_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        console.error(err);
        showToast('❌ Error al exportar bitácoras', 'error');
    }
}

// ---------------------------------------------------------
// IMPORT FUNCTIONS
// ---------------------------------------------------------

function generateUniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function isIdInRawData(id, rawData) {
    if (!id || !rawData) return false;
    const idStr = String(id).toLowerCase().trim();
    return Object.values(rawData).some(rows => 
        rows.some(row => Object.values(row).some(val => val != null && String(val).toLowerCase().trim() === idStr))
    );
}

async function _importExcelWithAI(rawWorkbookData) {
    const matsRef = typeof getMaterialCodes === 'function' ? getMaterialCodes() : [];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    
    const systemPrompt = `Eres un asistente de inteligencia artificial experto en migración y limpieza de datos para la aplicación Reciminsaap. Mapea los datos del Excel a nuestras listas: "invoices", "ingresos", "egresos". Las facturas tienen items con subcampos. Referencia materiales: ${JSON.stringify(matsRef.map(m=>({id:m.id,code:m.code,name:m.name})))}\nDevuelve solo JSON limpio con las 3 listas.`;
    
    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\nDatos crudos:\n${JSON.stringify(rawWorkbookData)}` }] }],
            generationConfig: { responseMimeType: "application/json" }
        })
    });

    if (!apiResponse.ok) throw new Error(`API Gemini Error: ${apiResponse.statusText}`);
    const jsonResp = await apiResponse.json();
    const aiText = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) throw new Error("Respuesta IA vacía");
    return JSON.parse(aiText.trim());
}

// ---------------------------------------------------------
// FUZZY MATCHING & DATA SANITIZATION HELPERS FOR EXCEL
// ---------------------------------------------------------

function _cleanStringKey(key) {
    if (!key) return '';
    return String(key)
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Strip accents
        .replace(/[^a-z0-9]/g, ''); // Keep alphanumeric only
}

function _getColVal(row, patterns, defaultVal = '') {
    if (!row || typeof row !== 'object') return defaultVal;
    const cleanedKeysMap = {};
    Object.keys(row).forEach(k => {
        cleanedKeysMap[_cleanStringKey(k)] = row[k];
    });

    for (const pattern of patterns) {
        const cleanPattern = _cleanStringKey(pattern);
        if (cleanedKeysMap[cleanPattern] !== undefined && cleanedKeysMap[cleanPattern] !== null && cleanedKeysMap[cleanPattern] !== '') {
            return String(cleanedKeysMap[cleanPattern]).trim();
        }
    }
    // Partial substring match search
    for (const pattern of patterns) {
        const cleanPattern = _cleanStringKey(pattern);
        for (const k in cleanedKeysMap) {
            if (k.includes(cleanPattern) || cleanPattern.includes(k)) {
                if (cleanedKeysMap[k] !== undefined && cleanedKeysMap[k] !== null && cleanedKeysMap[k] !== '') {
                    return String(cleanedKeysMap[k]).trim();
                }
            }
        }
    }
    return defaultVal;
}

function _parseNumVal(val, defaultNum = 0) {
    if (val === null || val === undefined || val === '') return defaultNum;
    if (typeof val === 'number') return isNaN(val) ? defaultNum : val;
    let str = String(val).trim();
    // Strip currency symbols, formulas (=...), space formatting
    str = str.replace(/^=/, '').replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? defaultNum : num;
}

function _excelSerialToDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000 + 12 * 3600 * 1000);
    const fractionalDay = serial - Math.floor(serial) + 0.0000001;
    if (fractionalDay > 0.001) {
        let totalSeconds = Math.floor(86400 * fractionalDay);
        const seconds = totalSeconds % 60;
        totalSeconds = Math.floor(totalSeconds / 60);
        const minutes = totalSeconds % 60;
        const hours = Math.floor(totalSeconds / 60);
        dateInfo.setHours(hours, minutes, seconds);
    }
    return dateInfo;
}

function _parseDateTimeVal(row) {
    let dateStr = _getColVal(row, ['fecha', 'date', 'createdat', 'timestamp', 'dia', 'día', 'emision', 'creacion', 'creación', 'f_emision']);
    let timeStr = _getColVal(row, ['hora', 'time', 'clock', 'hh:mm', 'h_creacion', 'h.creacion', 'tiempo']);
    let rawCreated = _getColVal(row, ['fechacreacion', 'fecha de creacion', 'createdat', 'timestamp', 'creadoen', 'fecha_creacion']);

    let parsedDateObj = null;

    if (rawCreated) {
        const numSerial = parseFloat(rawCreated);
        if (!isNaN(numSerial) && numSerial > 30000 && numSerial < 60000) {
            parsedDateObj = _excelSerialToDate(numSerial);
        } else {
            let cStr = String(rawCreated).trim();
            if (cStr.includes('T')) cStr = cStr.split('T')[0];
            if (cStr.includes(' ')) cStr = cStr.split(' ')[0];
            if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(cStr)) {
                const parts = cStr.split(/[\/-]/);
                cStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            const match = cStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const y = parseInt(match[1], 10);
                const m = parseInt(match[2], 10) - 1;
                const d = parseInt(match[3], 10);
                parsedDateObj = new Date(y, m, d, 12, 0, 0);
            } else {
                const d = new Date(`${cStr}T12:00:00`);
                if (!isNaN(d.getTime())) parsedDateObj = d;
            }
        }
    }

    if (!parsedDateObj && dateStr) {
        const numSerial = parseFloat(dateStr);
        if (!isNaN(numSerial) && numSerial > 30000 && numSerial < 60000) {
            parsedDateObj = _excelSerialToDate(numSerial);
        } else {
            // Handle DD/MM/YYYY vs YYYY-MM-DD
            let dStr = String(dateStr).trim();
            if (dStr.includes('T')) dStr = dStr.split('T')[0];
            if (dStr.includes(' ')) dStr = dStr.split(' ')[0];
            if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(dStr)) {
                const parts = dStr.split(/[\/-]/);
                dStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            
            const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const y = parseInt(match[1], 10);
                const m = parseInt(match[2], 10) - 1;
                const d = parseInt(match[3], 10);
                let hours = 12, mins = 0;
                if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
                    const tParts = timeStr.split(':');
                    hours = parseInt(tParts[0], 10);
                    mins = parseInt(tParts[1], 10);
                }
                parsedDateObj = new Date(y, m, d, hours, mins, 0);
            } else {
                const timePart = (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) ? `T${timeStr}:00` : 'T12:00:00';
                const d = new Date(`${dStr}${timePart}`);
                if (!isNaN(d.getTime())) parsedDateObj = d;
            }
        }
    }

    if (!parsedDateObj) {
        parsedDateObj = new Date();
    }

    const year = parsedDateObj.getFullYear();
    const month = String(parsedDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDateObj.getDate()).padStart(2, '0');
    const finalDate = `${year}-${month}-${day}`;
    
    let finalTime = timeStr;
    if (!finalTime) {
        const h = String(parsedDateObj.getHours()).padStart(2, '0');
        const m = String(parsedDateObj.getMinutes()).padStart(2, '0');
        finalTime = `${h}:${m}`;
    }

    return {
        date: finalDate,
        time: finalTime,
        createdAt: `${finalDate}T${finalTime}:00`
    };
}

function generateDeterministicId(prefix, item) {
    const raw = `${item.date || ''}_${(item.concept || item.client || '').toLowerCase().trim()}_${item.amount || item.total || 0}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return `${prefix}-${Math.abs(hash)}`;
}

function _importExcelManual(workbook) {
    const parsed = {
        invoices: [],
        ingresos: [],
        egresos: [],
        material_codes: [],
        clients: []
    };
    
    const hasSpecificFinanceSheets = workbook.SheetNames.some(name => {
        const n = name.toLowerCase().trim();
        return (n.includes('ingreso') || n.includes('egreso')) && !n.includes('finanza') && !n.includes('balance');
    });

    for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (!rows || rows.length === 0) continue;

        const sheetLower = sheetName.toLowerCase().trim();

        // 1. FACTURAS Y BITÁCORAS
        if (sheetLower.includes('factura') || sheetLower.includes('bitacora') || sheetLower.includes('bitácora') || sheetLower.includes('registro')) {
            const invMap = {};
            rows.forEach(r => {
                const rawId = _getColVal(r, ['id', 'codigo', 'num', 'factura', 'folio']);
                const dt = _parseDateTimeVal(r);
                const clientVal = _getColVal(r, ['cliente', 'client', 'customer', 'comprador', 'vendedor', 'empresa', 'razon social', 'nombre'], 'Cliente General');
                const rawType = (_getColVal(r, ['tipo', 'type', 'clase', 'categoria', 'operacion']) || '').toLowerCase().trim();
                let typeVal = 'basica';
                if (rawType === 'empresa' || rawType === 'local') {
                    typeVal = rawType;
                } else if (rawType === 'basica' || rawType.includes('bit') || (rawId && String(rawId).toUpperCase().startsWith('BIT'))) {
                    typeVal = 'basica';
                } else if (sheetLower.includes('factura')) {
                    typeVal = 'empresa';
                } else {
                    typeVal = 'basica';
                }

                const groupKey = rawId ? String(rawId) : `group_${dt.date}_${clientVal}_${typeVal}`;

                if (!invMap[groupKey]) {
                    invMap[groupKey] = {
                        id: rawId ? String(rawId) : null,
                        date: dt.date,
                        time: dt.time,
                        createdAt: dt.createdAt,
                        client: clientVal,
                        rnc: _getColVal(r, ['rnc', 'taxid', 'cedula', 'identificacion']),
                        phone: _getColVal(r, ['telefono', 'teléfono', 'phone', 'celular']),
                        address: _getColVal(r, ['direccion', 'dirección', 'address']),
                        type: typeVal,
                        notes: _getColVal(r, ['notas', 'notes', 'observacion', 'comentario']),
                        items: []
                    };
                }

                const matName = _getColVal(r, ['material', 'producto', 'item', 'descripcion', 'descripción', 'articulo']);
                if (matName) {
                    const qty = _parseNumVal(_getColVal(r, ['cantidad', 'cant', 'qty', 'quantity', 'unidades', 'peso', 'kilos']), 1);
                    const priceBuy = _parseNumVal(_getColVal(r, ['precio compra', 'preciocompra', 'costo', 'compra', 'pricebuy']));
                    const priceSell = _parseNumVal(_getColVal(r, ['precio venta', 'precioventa', 'venta', 'pricesell', 'precio']));
                    const totalCompraCol = _parseNumVal(_getColVal(r, ['total compra', 'totalcompra', 'inversion']));
                    const totalVentaCol = _parseNumVal(_getColVal(r, ['total venta', 'totalventa', 'venta total']));

                    const calcTotalCompra = (qty > 0 && priceBuy > 0) ? (qty * priceBuy) : totalCompraCol;
                    const calcTotalVenta = (qty > 0 && priceSell > 0) ? (qty * priceSell) : totalVentaCol;

                    invMap[groupKey].items.push({
                        name: matName,
                        qty: qty,
                        unit: _getColVal(r, ['unidad', 'unit', 'medida'], 'kg'),
                        priceBuy: priceBuy,
                        priceSell: priceSell,
                        totalCompra: calcTotalCompra,
                        totalVenta: calcTotalVenta
                    });
                }
            });

            Object.values(invMap).forEach(inv => {
                inv.totalCompra = inv.items.reduce((s, it) => s + (it.totalCompra || 0), 0);
                inv.totalVenta = inv.items.reduce((s, it) => s + (it.totalVenta || 0), 0);
                inv.balance = inv.totalVenta - inv.totalCompra;
                inv.total = inv.totalVenta > 0 ? inv.totalVenta : (inv.totalCompra || inv.balance || 0);
            });
            parsed.invoices = Object.values(invMap);

        // 2. FINANZAS (INGRESOS Y EGRESOS COMBINADOS)
        } else if (sheetLower.includes('finanza') || sheetLower.includes('ingresos_y_egresos') || sheetLower.includes('balance')) {
            if (hasSpecificFinanceSheets) continue;
            rows.forEach(r => {
                const dt = _parseDateTimeVal(r);
                const originVal = _getColVal(r, ['origen', 'categoria', 'categoría', 'clasificacion', 'tipo'], 'Importado');
                const descVal = _getColVal(r, ['descripcion', 'descripción', 'concepto', 'detalle', 'motivo']);
                const notesVal = _getColVal(r, ['notas', 'notes', 'observacion']);
                const itemType = _getColVal(r, ['tipo', 'type', 'clase', 'movimiento']).toLowerCase();

                const ingVal = _parseNumVal(_getColVal(r, ['ingreso money in', 'ingreso', 'monto ingreso', 'entrada', 'inflow']));
                const egrVal = _parseNumVal(_getColVal(r, ['egreso money out', 'egreso', 'monto egreso', 'salida', 'outflow', 'gasto']));

                const descLower = (descVal || '').toLowerCase().trim();
                if (descLower.includes('total general') || descLower === 'total' || descLower.includes('balance general') || descLower.includes('totales generales') || descLower.includes('resumen diario')) {
                    return;
                }

                if (ingVal > 0 || itemType.includes('ingreso')) {
                    const itemObj = {
                        id: _getColVal(r, ['id', 'num', 'folio']) || null,
                        date: dt.date,
                        time: dt.time,
                        createdAt: dt.createdAt,
                        concept: descVal,
                        amount: ingVal > 0 ? ingVal : _parseNumVal(_getColVal(r, ['monto', 'amount', 'total', 'precio'])),
                        category: originVal,
                        notes: notesVal,
                        ref: _getColVal(r, ['id referencia', 'referencia', 'ref', 'invoice_id']) || null
                    };
                    if (!itemObj.id) itemObj.id = generateDeterministicId('ING', itemObj);
                    if (!parsed.ingresos.some(x => x.id === itemObj.id || (x.date === itemObj.date && x.concept === itemObj.concept && x.amount === itemObj.amount))) {
                        parsed.ingresos.push(itemObj);
                    }
                }
                if (egrVal > 0 || itemType.includes('egreso')) {
                    const itemObj = {
                        id: _getColVal(r, ['id', 'num', 'folio']) || null,
                        date: dt.date,
                        time: dt.time,
                        createdAt: dt.createdAt,
                        concept: descVal,
                        amount: egrVal > 0 ? egrVal : _parseNumVal(_getColVal(r, ['monto', 'amount', 'total', 'precio'])),
                        category: originVal,
                        notes: notesVal,
                        ref: _getColVal(r, ['id referencia', 'referencia', 'ref', 'invoice_id']) || null
                    };
                    if (!itemObj.id) itemObj.id = generateDeterministicId('EGR', itemObj);
                    if (!parsed.egresos.some(x => x.id === itemObj.id || (x.date === itemObj.date && x.concept === itemObj.concept && x.amount === itemObj.amount))) {
                        parsed.egresos.push(itemObj);
                    }
                }
            });

        // 3. PESTAÑA INGRESOS INDIVIDUAL
        } else if (sheetLower.includes('ingreso')) {
            rows.forEach(r => {
                const descVal = _getColVal(r, ['concepto', 'descripcion', 'descripción', 'detalle']);
                const descLower = (descVal || '').toLowerCase().trim();
                if (!descLower || descLower.includes('total general') || descLower === 'total' || descLower.includes('balance general') || descLower.includes('totales generales') || descLower.includes('resumen diario')) {
                    return;
                }

                const dt = _parseDateTimeVal(r);
                const itemObj = {
                    id: _getColVal(r, ['id', 'num', 'folio']) || null,
                    date: dt.date,
                    time: dt.time,
                    createdAt: dt.createdAt,
                    concept: descVal,
                    amount: _parseNumVal(_getColVal(r, ['monto', 'ingreso', 'monto ingreso', 'amount', 'total'])),
                    category: _getColVal(r, ['categoria', 'categoría', 'origen', 'tipo'], 'Importado'),
                    notes: _getColVal(r, ['notas', 'notes']),
                    ref: _getColVal(r, ['id referencia', 'referencia', 'ref', 'invoice_id']) || null
                };
                if (!itemObj.id) itemObj.id = generateDeterministicId('ING', itemObj);
                if (!parsed.ingresos.some(x => x.id === itemObj.id || (x.date === itemObj.date && x.concept === itemObj.concept && x.amount === itemObj.amount))) {
                    parsed.ingresos.push(itemObj);
                }
            });

        // 4. PESTAÑA EGRESOS INDIVIDUAL
        } else if (sheetLower.includes('egreso')) {
            rows.forEach(r => {
                const descVal = _getColVal(r, ['concepto', 'descripcion', 'descripción', 'detalle']);
                const descLower = (descVal || '').toLowerCase().trim();
                if (!descLower || descLower.includes('total general') || descLower === 'total' || descLower.includes('balance general') || descLower.includes('totales generales') || descLower.includes('resumen diario')) {
                    return;
                }

                const dt = _parseDateTimeVal(r);
                const itemObj = {
                    id: _getColVal(r, ['id', 'num', 'folio']) || null,
                    date: dt.date,
                    time: dt.time,
                    createdAt: dt.createdAt,
                    concept: descVal,
                    amount: _parseNumVal(_getColVal(r, ['monto', 'egreso', 'monto egreso', 'amount', 'total'])),
                    category: _getColVal(r, ['categoria', 'categoría', 'origen', 'tipo'], 'Importado'),
                    notes: _getColVal(r, ['notas', 'notes']),
                    ref: _getColVal(r, ['id referencia', 'referencia', 'ref', 'invoice_id']) || null
                };
                if (!itemObj.id) itemObj.id = generateDeterministicId('EGR', itemObj);
                if (!parsed.egresos.some(x => x.id === itemObj.id || (x.date === itemObj.date && x.concept === itemObj.concept && x.amount === itemObj.amount))) {
                    parsed.egresos.push(itemObj);
                }
            });

        // 5. CATÁLOGO DE MATERIALES
        } else if (sheetLower.includes('material') || sheetLower.includes('catalogo') || sheetLower.includes('catálogo')) {
            parsed.material_codes = rows.map(r => {
                const dt = _parseDateTimeVal(r);
                return {
                    id: _getColVal(r, ['id', 'key']) || null,
                    code: _getColVal(r, ['codigo', 'código', 'code', 'sku']),
                    name: _getColVal(r, ['nombre', 'material', 'producto', 'descripcion', 'descripción']),
                    familyId: _getColVal(r, ['familia', 'family', 'categoria', 'categoría'], 'General'),
                    unit: _getColVal(r, ['unidad', 'unidad medida', 'unit'], 'kg'),
                    priceBuy: _parseNumVal(_getColVal(r, ['precio compra', 'preciocompra', 'costo', 'pricebuy'])),
                    priceSell: _parseNumVal(_getColVal(r, ['precio venta', 'precioventa', 'pricesell', 'precio'])),
                    stockCurrent: _parseNumVal(_getColVal(r, ['stock actual', 'stock', 'cantidad'])),
                    stockMin: _parseNumVal(_getColVal(r, ['stock minimo', 'stock mínimo', 'stock_min'])),
                    date: dt.date,
                    time: dt.time,
                    createdAt: dt.createdAt
                };
            });

        // 6. CLIENTES
        } else if (sheetLower.includes('cliente')) {
            parsed.clients = rows.map(r => {
                const dt = _parseDateTimeVal(r);
                return {
                    id: _getColVal(r, ['id', 'num']) || null,
                    name: _getColVal(r, ['nombre', 'cliente', 'customer', 'empresa', 'razon social']),
                    rnc: _getColVal(r, ['rnc', 'taxid', 'cedula']),
                    phone: _getColVal(r, ['telefono', 'teléfono', 'phone', 'celular']),
                    address: _getColVal(r, ['direccion', 'dirección', 'address']),
                    email: _getColVal(r, ['correo', 'email', 'mail']),
                    notes: _getColVal(r, ['notas', 'notes']),
                    date: dt.date,
                    time: dt.time,
                    createdAt: dt.createdAt
                };
            });
        }
    }
    return parsed;
}

async function _mergeAndSaveData(parsedData, rawWorkbookData) {
    let importedCounts = { invoices: 0, ingresos: 0, egresos: 0, material_codes: 0, clients: 0 };

    const allImportedItems = [
        ...(parsedData.invoices || []),
        ...(parsedData.ingresos || []),
        ...(parsedData.egresos || [])
    ];
    const hasMayInImport = allImportedItems.some(i => i && i.date && i.date.startsWith('2026-05'));

    ['invoices', 'ingresos', 'egresos', 'material_codes', 'clients'].forEach(type => {
        if (parsedData[type] && Array.isArray(parsedData[type]) && parsedData[type].length > 0) {
            const localKey = userKey(`recim_${type}`);
            let localList = JSON.parse(localStorage.getItem(localKey) || '[]');
            
            // Si el archivo Excel no trae registros de Mayo, purgar registros antiguos de Mayo en localStorage
            if (!hasMayInImport && (type === 'invoices' || type === 'ingresos' || type === 'egresos')) {
                localList = localList.filter(i => !i.date || !i.date.startsWith('2026-05'));
            }

            parsedData[type].forEach(item => {
                const prefixMap = { invoices: 'INV', ingresos: 'ING', egresos: 'EGR', material_codes: 'MAT', clients: 'CLI' };
                if (!item.id || !isIdInRawData(item.id, rawWorkbookData)) {
                    item.id = generateDeterministicId(prefixMap[type] || 'REC', item);
                }

                // 1. Buscar coincidencia por ID
                let idx = localList.findIndex(i => i.id === item.id);

                // 2. Si no coincide por ID, buscar coincidencia por concepto/cliente + monto
                if (idx === -1 && (type === 'ingresos' || type === 'egresos')) {
                    const cTarget = (item.concept || '').toLowerCase().trim();
                    const aTarget = Math.round((item.amount || 0) * 100);
                    if (cTarget && aTarget > 0) {
                        idx = localList.findIndex(i => {
                            const cExisting = (i.concept || '').toLowerCase().trim();
                            const aExisting = Math.round((i.amount || 0) * 100);
                            return cExisting === cTarget && aExisting === aTarget;
                        });
                    }
                }

                if (idx !== -1) localList[idx] = item;
                else localList.push(item);
                importedCounts[type]++;
            });
            localStorage.setItem(localKey, JSON.stringify(localList));
        }
    });

    if (window.forceSync) await window.forceSync();
    
    const parts = [];
    if (importedCounts.invoices) parts.push(`${importedCounts.invoices} facturas/bitácoras`);
    if (importedCounts.ingresos) parts.push(`${importedCounts.ingresos} ingresos`);
    if (importedCounts.egresos) parts.push(`${importedCounts.egresos} egresos`);
    if (importedCounts.material_codes) parts.push(`${importedCounts.material_codes} materiales`);
    if (importedCounts.clients) parts.push(`${importedCounts.clients} clientes`);

    const summaryText = parts.length > 0 ? parts.join(', ') : '0 registros';
    showToast(`✅ Importación completada: ${summaryText}`, 'success', 6000);
    if (typeof rerenderCurrentPage === 'function') rerenderCurrentPage();
}

function importExcelData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const rawWorkbookData = {};
            for (const sheetName of workbook.SheetNames) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                if (rows.length > 0) rawWorkbookData[sheetName] = rows;
            }

            if (Object.keys(rawWorkbookData).length === 0) return showToast('⚠️ Archivo Excel vacío', 'warning');

            showToast('🔄 Procesando archivo Excel...', 'info');
            let parsedData = _importExcelManual(workbook);

            const totalItems = (parsedData.invoices?.length || 0) + (parsedData.ingresos?.length || 0) + (parsedData.egresos?.length || 0) + (parsedData.material_codes?.length || 0) + (parsedData.clients?.length || 0);

            if (totalItems === 0 && typeof geminiApiKey !== 'undefined' && geminiApiKey) {
                showToast('🤖 IA: Analizando estructura no estándar de Excel...', 'info', 8000);
                try {
                    const aiParsed = await _importExcelWithAI(rawWorkbookData);
                    if (aiParsed && (aiParsed.invoices?.length || aiParsed.ingresos?.length || aiParsed.egresos?.length)) {
                        parsedData = aiParsed;
                    }
                } catch (aiErr) {
                    console.warn("🤖 Error IA en fallback:", aiErr);
                }
            }

            if (parsedData.invoices.length || parsedData.ingresos.length || parsedData.egresos.length || parsedData.material_codes.length || parsedData.clients.length) {
                await _mergeAndSaveData(parsedData, rawWorkbookData);
            } else {
                showToast('⚠️ No se encontraron datos válidos para importar en el archivo Excel', 'warning');
            }

        } catch (err) {
            console.error('Import Error:', err);
            showToast('❌ Error al importar archivo', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}
