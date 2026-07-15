/* =============================================
   EXCEL-UTILS.JS – Exportación a XLSX (SheetJS / xlsx-js-style)
   Modelo: Registro de Residuos, Finanzas y Materiales
   ============================================= */

/**
 * Aplica estilos premium, alineación, formato de moneda y auto-ajuste de columnas a una hoja de cálculo.
 */
function formatAndStyleWorksheet(ws) {
    if (!ws || !ws['!ref']) return ws;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const cur = (typeof getCurrency === 'function') ? getCurrency() : { symbol: 'RD$', code: 'DOP' };
    const curSymbol = cur.symbol.replace(/"/g, '""');
    const currencyFormat = `"${curSymbol}"#,##0.00`;
    
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
            if (cell.f) valStr = '   $999,999.00   '; 
            else if (cell.v != null) {
                valStr = String(cell.v);
                if (cell.t === 'n' && cell.z === currencyFormat) valStr = cur.symbol + valStr + '.00';
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
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function buildInvoiceSheet(invoices, isBitacoraList = false) {
    const headers = isBitacoraList
      ? ['ID Bitácora', 'Fecha', 'Cliente/Procedencia', 'Material', 'Cantidad', 'Unidad', 'Peso (kg)', 'Costo Compra', 'Precio Venta', 'Total Compra', 'Total Venta', 'Balance', 'Notas']
      : ['ID', 'Fecha', 'Cliente', 'Tipo', 'Material', 'Cantidad', 'Unidad', 'Precio Compra', 'Precio Venta', 'Total Compra', 'Total Venta', 'Ganancia', 'Notas'];
    
    const rows = [];
    let rowNum = 2;

    invoices.forEach(inv => {
        (inv.items || []).forEach(item => {
            const pBuy = item.priceBuy || item.uprice || 0;
            const pSell = item.priceSell || 0;
            const qtyCol = isBitacoraList ? 'E' : 'F';
            const costCol = isBitacoraList ? 'H' : 'H';
            const sellCol = isBitacoraList ? 'I' : 'I';
            const tCostCol = isBitacoraList ? 'J' : 'J';
            const tSellCol = isBitacoraList ? 'K' : 'K';
            
            const r = isBitacoraList 
              ? [inv.id, inv.date, inv.client || '—', item.name || '', item.qty || 0, item.unit || 'lb', item.peso || 0, pBuy, pSell, {f: `${qtyCol}${rowNum}*${costCol}${rowNum}`}, {f: `${qtyCol}${rowNum}*${sellCol}${rowNum}`}, {f: `${tSellCol}${rowNum}-${tCostCol}${rowNum}`}, inv.notes || '']
              : [inv.id, inv.date, inv.client || inv.company || '—', inv.type || 'basic', item.name || item.desc || '', item.qty || 0, item.unit || 'kg', pBuy, pSell, {f: `${qtyCol}${rowNum}*${costCol}${rowNum}`}, {f: `${qtyCol}${rowNum}*${sellCol}${rowNum}`}, {f: `${tSellCol}${rowNum}-${tCostCol}${rowNum}`}, inv.notes || ''];
            
            rows.push(r);
            rowNum++;
        });
    });
    return { name: isBitacoraList ? 'Registros_Detallados' : 'Facturas', data: [headers, ...rows] };
}

function buildFinanceSheet(dataList, sheetName) {
    const headers = ['ID', 'Fecha', 'Concepto', 'Monto', 'Categoría', 'Notas'];
    const rows = dataList.map(item => [item.id, item.date, item.concept, item.amount, item.category || 'General', item.notes || '']);
    return { name: sheetName, data: [headers, ...rows] };
}

function buildCombinedFinanceSheet(incomes, expenses) {
    const headers = ['Fecha', 'Origen', 'Descripción', 'Ingreso Money IN', 'Egreso Money OUT', 'Balance general', 'Notas'];
    
    const combined = [];
    incomes.forEach(item => combined.push({ ...item, type: 'income' }));
    expenses.forEach(item => combined.push({ ...item, type: 'expense' }));
    
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
        // Fila 2 (primer dato): =D2-E2
        // Filas siguientes: =F{r-1}+D{r}-E{r}
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
        // r es la fila de Excel del TOTAL GENERAL (1-indexed)
        // El rango de datos va desde la fila 2 hasta la fila r-2
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

        if (selection.invoices) {
            const invs = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
            if (invs.length) {
                const s = buildInvoiceSheet(invs);
                XLSX.utils.book_append_sheet(wb, formatAndStyleWorksheet(XLSX.utils.aoa_to_sheet(s.data)), s.name);
                sheetsAdded++;
            }
        }
        if (selection.income || selection.expenses) {
            const ings = selection.income ? JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]') : [];
            const egs = selection.expenses ? JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]') : [];
            if (ings.length || egs.length) {
                const s = buildCombinedFinanceSheet(ings, egs);
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

        if (sheetsAdded === 0) return showToast('⚠️ No hay datos para exportar en las categorías seleccionadas', 'warning');
        downloadExcel(wb, `Reciminsa_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
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

function _importExcelManual(workbook) {
    const parsed = { invoices: [], ingresos: [], egresos: [] };
    
    for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (sheetName.toLowerCase().includes('factura') || sheetName.toLowerCase().includes('registro')) {
            const invMap = {};
            rows.forEach(r => {
                const rawId = r.ID || r.id;
                const groupKey = rawId || `group_${r.Fecha || 'nofecha'}_${r.Cliente || 'nocliente'}`;
                if (!invMap[groupKey]) {
                    invMap[groupKey] = { id: rawId ? String(rawId) : null, date: r.Fecha || r.fecha, client: r.Cliente || r.cliente, type: r.Tipo || r.tipo, notes: r.Notas || r.notas || '', items: [], createdAt: new Date().toISOString() };
                }
                invMap[groupKey].items.push({
                    name: r.Material || r.material || '', qty: parseFloat(r.Cantidad || r.cantidad || 0), unit: r.Unidad || r.unidad || 'kg',
                    priceBuy: parseFloat(r['Precio Compra'] || r.Precio_Compra || 0), priceSell: parseFloat(r['Precio Venta'] || r.Precio_Venta || 0)
                });
            });
            parsed.invoices = Object.values(invMap);
        } else if (sheetName.toLowerCase().includes('finanzas') || sheetName.toLowerCase().includes('ingresos_y_egresos') || sheetName.toLowerCase().includes('ingresos y egresos') || sheetName.toLowerCase().includes('balance')) {
            rows.forEach(r => {
                const dateVal = r.Fecha || r.fecha || '';
                const originVal = r.Origen || r.origen || r.Categoría || r.categoria || 'Importado';
                const descVal = r.Descripción || r.descripcion || r.Concepto || r.concepto || '';
                const notesVal = r.Notas || r.notas || '';
                
                const ingVal = parseFloat(r['Ingreso Money IN'] || r['ingreso'] || r['Ingreso'] || r['Monto'] || 0);
                const egrVal = parseFloat(r['Egreso Money OUT'] || r['egreso'] || r['Egreso'] || 0);
                
                if (ingVal > 0) {
                    parsed.ingresos.push({
                        id: r.ID || r.id ? String(r.ID||r.id) : null,
                        date: dateVal,
                        concept: descVal,
                        amount: ingVal,
                        category: originVal,
                        notes: notesVal
                    });
                }
                if (egrVal > 0) {
                    parsed.egresos.push({
                        id: r.ID || r.id ? String(r.ID||r.id) : null,
                        date: dateVal,
                        concept: descVal,
                        amount: egrVal,
                        category: originVal,
                        notes: notesVal
                    });
                }
            });
        } else if (sheetName.toLowerCase().includes('ingreso')) {
            parsed.ingresos = rows.map(r => ({ id: r.ID || r.id ? String(r.ID||r.id) : null, date: r.Fecha || r.fecha, concept: r.Concepto || r.concepto, amount: parseFloat(r.Monto || r.monto || 0), category: r.Categoría || r.categoria || 'Importado', notes: r.Notas || r.notas || '' }));
        } else if (sheetName.toLowerCase().includes('egreso')) {
            parsed.egresos = rows.map(r => ({ id: r.ID || r.id ? String(r.ID||r.id) : null, date: r.Fecha || r.fecha, concept: r.Concepto || r.concepto, amount: parseFloat(r.Monto || r.monto || 0), category: r.Categoría || r.categoria || 'Importado', notes: r.Notas || r.notas || '' }));
        }
    }
    return parsed;
}

async function _mergeAndSaveData(parsedData, rawWorkbookData) {
    let importedCounts = { invoices: 0, ingresos: 0, egresos: 0 };
    
    ['invoices', 'ingresos', 'egresos'].forEach(type => {
        if (parsedData[type] && Array.isArray(parsedData[type])) {
            const localKey = userKey(`recim_${type}`);
            const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
            
            parsedData[type].forEach(item => {
                if (!item.id || !isIdInRawData(item.id, rawWorkbookData)) {
                    item.id = generateUniqueId(type === 'invoices' ? (item.type==='normal'?'INV':'BIT') : type.substring(0,3).toUpperCase());
                }
                const idx = localList.findIndex(i => i.id === item.id);
                if (idx !== -1) localList[idx] = item;
                else localList.push(item);
                importedCounts[type]++;
            });
            localStorage.setItem(localKey, JSON.stringify(localList));
        }
    });

    if (window.forceSync) await window.forceSync();
    showToast(`✅ Importación completada (${importedCounts.invoices} facturas, ${importedCounts.ingresos} ing, ${importedCounts.egresos} egr)`, 'success', 6000);
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

            let parsedData = null;
            if (typeof geminiApiKey !== 'undefined' && geminiApiKey) {
                showToast('🤖 IA: Analizando Excel...', 'info', 8000);
                try {
                    parsedData = await _importExcelWithAI(rawWorkbookData);
                } catch (aiErr) {
                    console.warn("🤖 Error IA, usando fallback manual...", aiErr);
                }
            }

            if (!parsedData) {
                showToast('Ejecutando importación manual...', 'info');
                parsedData = _importExcelManual(workbook);
            }

            if (parsedData.invoices.length || parsedData.ingresos.length || parsedData.egresos.length) {
                await _mergeAndSaveData(parsedData, rawWorkbookData);
            } else {
                showToast('⚠️ No se encontraron pestañas válidas para importar', 'warning');
            }

        } catch (err) {
            console.error('Import Error:', err);
            showToast('❌ Error al importar archivo', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}
